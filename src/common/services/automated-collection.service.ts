import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient, Prisma, SubscriptionStatus } from '@prisma/client';
import { OrderStatus } from '../../common/constants/enums';
import { OrdersService } from '../../orders/orders.service';
import { CreateOrderDto } from '../../orders/dto/create-order.dto';
import { OrderCollectionEditService } from './order-collection-edit.service';
import { FilterAutomatedCollectionsDto } from '../../orders/dto/filter-automated-collections.dto';
import {
  AutomatedCollectionResponseDto,
  AutomatedCollectionListResponseDto,
} from '../../orders/dto/automated-collection-response.dto';
import {
  GeneratePdfCollectionsDto,
  PdfGenerationResponseDto,
} from '../../orders/dto/generate-pdf-collections.dto';
import {
  GenerateRouteSheetDto,
  RouteSheetResponseDto,
} from '../../orders/dto/generate-route-sheet.dto';
import { GenerateDailyRouteSheetsDto } from '../../orders/dto/generate-daily-route-sheets.dto';
import { DeleteAutomatedCollectionResponseDto } from '../../orders/dto/delete-automated-collection.dto';
import { PdfGeneratorService } from './pdf-generator.service';
import { RouteSheetGeneratorService } from './route-sheet-generator.service';
import { AuditService } from '../../audit/audit.service';
import {
  isValidYMD,
  parseYMD,
  formatBAYMD,
  startOfDayBA,
  formatBATimestampISO,
  formatLocalYMD,
} from '../utils/date.utils';
import * as fs from 'fs';
import * as path from 'path';

export interface CollectionOrderSummaryDto {
  cycle_id: number;
  subscription_id: number;
  customer_id: number;
  customer_name: string;
  subscription_plan_name: string;
  payment_due_date: string;
  pending_balance: number;
  order_created: boolean;
  order_id?: number;
  notes?: string;
}

@Injectable()
export class AutomatedCollectionService
  extends PrismaClient
  implements OnModuleInit
{
  private readonly logger = new Logger(AutomatedCollectionService.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly pdfGeneratorService: PdfGeneratorService,
    private readonly routeSheetGeneratorService: RouteSheetGeneratorService,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  /**
   * Aplica recargos por mora a ciclos vencidos sin período de gracia
   */
  private async applyLateFeesToOverdueCycles(): Promise<void> {
    try {
      const today = startOfDayBA(new Date());

      const thresholdDate = new Date(today);
      thresholdDate.setDate(thresholdDate.getDate() - 10);

      const overdueCycles = await this.subscription_cycle.findMany({
        where: {
          payment_due_date: {
            lte: thresholdDate,
          },
          late_fee_applied: false,
          pending_balance: { gt: 0 },
          customer_subscription: {
            status: SubscriptionStatus.ACTIVE,
          },
        },
        include: {
          customer_subscription: {
            include: {
              subscription_plan: true,
            },
          },
        },
      });

      this.logger.log(
        `📋 Encontrados ${overdueCycles.length} ciclos vencidos para aplicar recargos`,
      );

      for (const cycle of overdueCycles) {
        try {
          // Determinar el precio base y calcular recargo del 20%
          const planPriceRaw =
            cycle.customer_subscription?.subscription_plan?.price;
          const currentTotalRaw = cycle.total_amount;
          const paidAmountRaw = cycle.paid_amount;

          const planPrice = parseFloat(planPriceRaw?.toString() || '0');
          const currentTotal = parseFloat(currentTotalRaw?.toString() || '0');
          const paidAmount = parseFloat(paidAmountRaw?.toString() || '0');

          // Si no tenemos total actual, usar el precio del plan como base
          const baseAmount = currentTotal > 0 ? currentTotal : planPrice;
          const lateFeePercentage = 0.2; // 20%
          const surcharge =
            Math.round(baseAmount * lateFeePercentage * 100) / 100;
          const newTotal = Math.round((baseAmount + surcharge) * 100) / 100;
          const newPending = Math.max(
            0,
            Math.round((newTotal - paidAmount) * 100) / 100,
          );

          // Marcar como vencido, aplicar recargo y actualizar montos
          await this.subscription_cycle.update({
            where: { cycle_id: cycle.cycle_id },
            data: {
              is_overdue: true,
              late_fee_applied: true,
              late_fee_percentage: lateFeePercentage,
              total_amount: newTotal,
              pending_balance: newPending,
              payment_status: newPending > 0 ? 'OVERDUE' : 'PAID',
            },
          });

          this.logger.log(
            `✅ Recargo aplicado al ciclo ${cycle.cycle_id}: +$${surcharge} (20% de $${baseAmount})`,
          );
        } catch (error) {
          this.logger.error(
            `❌ Error al aplicar recargo al ciclo ${cycle.cycle_id}:`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        '❌ Error al buscar ciclos vencidos para recargos:',
        error,
      );
    }
  }

  async onModuleInit() {
    this.logger.log('🚀 AutomatedCollectionService inicializado correctamente');
    await this.$connect();
  }

  /**
   * Ejecuta la generación automática de pedidos de cobranza todos los días a las 6 AM
   * @deprecated Esta función se ejecuta ahora mediante cron del sistema invocando el script de generación
   */
  // Cron decorator removed in favor of system cron
  async generateCollectionOrders() {
    this.logger.log(
      '🔄 Iniciando generación automática de pedidos de cobranza...',
    );

    // Primero aplicar recargos por mora a ciclos vencidos
    this.logger.log(
      '💰 Aplicando recargos por mora antes de generar órdenes...',
    );
    await this.applyLateFeesToOverdueCycles();

    try {
      const today = startOfDayBA(new Date());

      // Ajustar fecha si es domingo (generar el sábado anterior)
      const targetDate = this.adjustDateForSunday(today);

      // Buscar ciclos que vencen hoy y necesitan pedido de cobranza
      const cyclesDueToday = await this.getCyclesDueForCollection(targetDate);

      this.logger.log(
        `📊 Encontrados ${cyclesDueToday.length} ciclos que requieren pedido de cobranza para ${formatBAYMD(targetDate)}`,
      );

      const results: CollectionOrderSummaryDto[] = [];

      for (const cycle of cyclesDueToday) {
        try {
          // Verificar si ya existe una orden de cobranza manual para este ciclo
          const hasManualOrder = await this.hasCollectionOrderForCycle(
            cycle.cycle_id,
          );

          if (hasManualOrder) {
            this.logger.log(
              `⚠️ Saltando ciclo ${cycle.cycle_id} - ya tiene una orden de cobranza manual`,
            );
            results.push({
              cycle_id: cycle.cycle_id,
              subscription_id: cycle.subscription_id,
              customer_id: cycle.customer_subscription.customer_id,
              customer_name: cycle.customer_subscription.person.name,
              subscription_plan_name:
                cycle.customer_subscription.subscription_plan.name,
              payment_due_date: formatBAYMD(
                cycle.payment_due_date || new Date(),
              ),
              pending_balance: Number(cycle.pending_balance),
              order_created: false,
              notes:
                'Ciclo ya tiene orden de cobranza manual - no se genera automática',
            });
            continue;
          }

          const result = await this.createOrUpdateCollectionOrder(
            cycle,
            targetDate,
            true, // isAutomatic = true para cobranzas automáticas
          );
          results.push(result);
        } catch (error) {
          this.logger.error(
            `❌ Error procesando ciclo ${cycle.cycle_id}:`,
            error,
          );
          results.push({
            cycle_id: cycle.cycle_id,
            subscription_id: cycle.subscription_id,
            customer_id: cycle.customer_subscription.customer_id,
            customer_name: cycle.customer_subscription.person.name,
            subscription_plan_name:
              cycle.customer_subscription.subscription_plan.name,
            payment_due_date: formatBAYMD(cycle.payment_due_date || new Date()),
            pending_balance: Number(cycle.pending_balance),
            order_created: false,
            notes: `Error: ${error.message}`,
          });
        }
      }

      const successCount = results.filter((r) => r.order_created).length;
      this.logger.log(
        `✅ Generación automática completada: ${successCount}/${results.length} pedidos creados/actualizados`,
      );

      return results;
    } catch (error) {
      this.logger.error(
        '❌ Error durante la generación automática de pedidos de cobranza:',
        error,
      );
      throw error;
    }
  }

  /**
   * Genera automáticamente hojas de ruta de cobranzas por vehículo y zonas cada día
   * Se ejecuta a las 6:30 AM para dar tiempo a que termine la generación de órdenes (6:00 AM)
   * @deprecated Esta función se ejecuta ahora mediante cron del sistema invocando el script de generación
   */
  // Cron decorator removed in favor of system cron
  async generateDailyCollectionRouteSheets() {
    this.logger.log(
      '🗺️ Iniciando generación automática de hojas de ruta de cobranzas...',
    );

    try {
      const today = startOfDayBA(new Date());
      const dateIso = formatBAYMD(today);

      try {
        const orderResults = await this.generateCollectionOrdersForDate(today);
        const createdCount = orderResults.filter((r) => r.order_created).length;
        this.logger.log(
          `🧾 Órdenes de cobranzas previas para ${dateIso}: ${createdCount}/${orderResults.length} creadas/actualizadas`,
        );
      } catch (error) {
        this.logger.error(
          '❌ Error generando órdenes automáticas previas:',
          error,
        );
      }

      try {
        const backfill =
          await this.backfillMissingCollectionOrdersUpToDate(today);
        this.logger.log(
          `🔄 Backfill de cobranzas para ${dateIso}: ${backfill.generated}/${backfill.checked} creadas`,
        );
      } catch (error) {
        this.logger.error('❌ Error ejecutando backfill de cobranzas:', error);
      }

      // Obtener vehículos activos con sus zonas asignadas
      const vehicles = await this.vehicle.findMany({
        where: { is_active: true },
        include: {
          vehicle_zone: {
            where: { is_active: true },
            select: { zone_id: true },
          },
        },
      });

      let generatedCount = 0;

      for (const vehicle of vehicles) {
        const zoneIds = vehicle.vehicle_zone.map((vz) => vz.zone_id);
        if (!zoneIds || zoneIds.length === 0) {
          this.logger.log(
            `↪️ Saltando vehículo ${vehicle.vehicle_id} - sin zonas activas asignadas`,
          );
          continue;
        }

        try {
          let assignedDriverId: number | undefined = undefined;
          try {
            const userVehicles = await this.user_vehicle.findMany({
              where: { vehicle_id: vehicle.vehicle_id, is_active: true },
              include: { user: true },
              orderBy: { assigned_at: 'desc' },
              take: 1,
            });
            assignedDriverId = userVehicles?.[0]?.user?.id || undefined;
          } catch (_) {}

          const filters: GenerateRouteSheetDto = {
            date: dateIso,
            zoneIds,
            vehicleId: vehicle.vehicle_id,
            driverId: assignedDriverId,
            overdueOnly: 'false',
            sortBy: 'zone',
            format: 'compact',
            notes: `Hoja de ruta automática de cobranzas - Vehículo ${vehicle.code || vehicle.name}`,
          } as any;

          // Generar y persistir PDF en /public/pdfs/collections
          const result =
            await this.routeSheetGeneratorService.generateRouteSheetAndPersist(
              filters,
            );

          generatedCount++;
          this.logger.log(
            `✅ Hoja de ruta generada para vehículo ${vehicle.vehicle_id} (${zoneIds.length} zonas) → ${result.downloadUrl}`,
          );
        } catch (error) {
          this.logger.error(
            `❌ Error generando hoja de ruta para vehículo ${vehicle.vehicle_id}:`,
            error,
          );
        }
      }

      this.logger.log(
        `🧾 Generación automática de hojas de ruta completada: ${generatedCount}/${vehicles.length} generadas`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Error durante la generación automática de hojas de ruta de cobranzas:',
        error,
      );
    }
  }

  /**
   * @deprecated Fallback ya no es necesario con la ejecución vía cron del sistema
   */
  // Cron decorator removed in favor of system cron
  async generateDailyCollectionRouteSheetsFallback() {
    try {
      const today = startOfDayBA(new Date());
      const dateIso = formatBAYMD(today);
      const dir = path.join(process.cwd(), 'public', 'pdfs', 'collections');
      let existsForDate = false;
      try {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir).filter((f) => f.endsWith('.pdf'));
          existsForDate = files.some(
            (f) =>
              f.includes(`_${dateIso}`) &&
              (f.startsWith('cobranza-automatica-hoja-de-ruta') ||
                f.startsWith('collection-route-sheet')),
          );
        }
      } catch (_) {}
      if (existsForDate) {
        this.logger.log(
          `⏭️ Fallback omitido, ya existen hojas de ruta para ${dateIso}`,
        );
        return;
      }
      this.logger.warn(
        `🛠️ Fallback: no hay hojas de ruta para ${dateIso}, generando...`,
      );
      await this.generateDailyCollectionRouteSheets();
    } catch (error) {
      this.logger.error(
        '❌ Error en fallback de hojas de ruta de cobranzas:',
        error,
      );
    }
  }

  /**
   * Endpoint helper: genera hojas de ruta diarias persistidas considerando fecha, vehículo y zonas.
   * Si se especifica vehicleId, procesa solo ese vehículo; de lo contrario, procesa todos los activos.
   * Ajusta la fecha si cae en domingo para alinearse con la generación de órdenes.
   */
  async triggerDailyCollectionRouteSheets(dto: GenerateDailyRouteSheetsDto) {
    this.logger.log(
      '🗺️ Disparo manual de generación diaria de hojas de ruta de cobranzas...',
    );
    let baseDate: Date;
    if (dto.date) {
      if (!isValidYMD(dto.date)) {
        throw new Error('La fecha debe estar en formato YYYY-MM-DD válido');
      }
      baseDate = parseYMD(dto.date);
    } else {
      baseDate = new Date();
      baseDate.setHours(0, 0, 0, 0);
    }
    const adjustedDate = this.adjustDateForSunday(baseDate);
    const dateIso = formatBAYMD(adjustedDate);

    // Primero: generar/actualizar órdenes automáticas para la fecha
    try {
      const orderResults =
        await this.generateCollectionOrdersForDate(adjustedDate);
      const createdCount = orderResults.filter((r) => r.order_created).length;
      this.logger.log(
        `🧾 Órdenes de cobranza para ${dateIso}: ${createdCount}/${orderResults.length} creadas/actualizadas`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Error generando órdenes automáticas previas:',
        error,
      );
      // Continuar con hojas de ruta aunque haya fallos parciales
    }

    // Segundo: backfill de órdenes faltantes hasta la fecha
    try {
      const backfill =
        await this.backfillMissingCollectionOrdersUpToDate(adjustedDate);
      this.logger.log(
        `🧾 Backfill de cobranzas para ${dateIso}: ${backfill.generated}/${backfill.checked} creadas`,
      );
    } catch (error) {
      this.logger.error('❌ Error ejecutando backfill de cobranzas:', error);
    }

    // Selección de vehículos
    const vehicles = await this.vehicle.findMany({
      where: dto.vehicleId
        ? { vehicle_id: dto.vehicleId, is_active: true }
        : { is_active: true },
      include: {
        vehicle_zone: { where: { is_active: true }, select: { zone_id: true } },
      },
    });

    let generatedCount = 0;
    const results: Array<{
      vehicleId: number;
      vehicleName?: string;
      vehicleCode?: string;
      zoneIds: number[];
      zoneNames?: string[];
      zones?: string[];
      drivers?: { id: number; name: string }[];
      assignedDriverId?: number;
      assignedDriverName?: string | null;
      downloadUrl?: string;
      error?: string;
    }> = [];

    for (const vehicle of vehicles) {
      const zoneIds =
        dto.zoneIds && dto.zoneIds.length > 0
          ? dto.zoneIds
          : vehicle.vehicle_zone.map((vz) => vz.zone_id);

      if (!zoneIds || zoneIds.length === 0) {
        this.logger.log(
          `↪️ Saltando vehículo ${vehicle.vehicle_id} - sin zonas activas asignadas`,
        );
        continue;
      }

      try {
        // Obtener nombres de zonas
        const zones = await this.zone.findMany({
          where: { zone_id: { in: zoneIds } },
          select: { zone_id: true, name: true },
        });
        const zoneNames = zones.map((z) => z.name);

        // Obtener drivers asignados al vehículo
        let drivers: { id: number; name: string }[] = [];
        try {
          const userVehicles = await this.user_vehicle.findMany({
            where: { vehicle_id: vehicle.vehicle_id, is_active: true },
            include: { user: true },
            orderBy: { assigned_at: 'desc' },
          });
          drivers = userVehicles
            .filter(
              (uv) =>
                uv.user && typeof uv.user.id === 'number' && !!uv.user.name,
            )
            .map((uv) => ({ id: uv.user.id, name: uv.user.name }));
        } catch (_) {
          drivers = [];
        }

        // Resolver driver asignado: si no se provee en dto, tomar el más recientemente asignado al vehículo
        const effectiveDriverId: number | undefined =
          dto.driverId ?? (drivers.length > 0 ? drivers[0].id : undefined);
        let assignedDriverName: string | null = null;
        if (typeof effectiveDriverId === 'number') {
          try {
            const user = await this.user.findUnique({
              where: { id: effectiveDriverId },
              select: { name: true },
            });
            assignedDriverName = user?.name ?? null;
            if (!assignedDriverName) {
              const person = await this.person.findUnique({
                where: { person_id: effectiveDriverId },
                select: { name: true },
              });
              assignedDriverName = person?.name ?? null;
            }
          } catch (_) {
            assignedDriverName =
              drivers.find((d) => d.id === effectiveDriverId)?.name ?? null;
          }
        }
        const filters: GenerateRouteSheetDto = {
          date: dateIso,
          zoneIds,
          vehicleId: vehicle.vehicle_id,
          driverId: effectiveDriverId,
          overdueOnly: dto.overdueOnly ?? 'false',
          sortBy: dto.sortBy ?? 'zone',
          format: dto.format ?? 'compact',
          notes:
            dto.notes ??
            `Hoja de ruta automática de cobranzas - Vehículo ${vehicle.code || vehicle.name}`,
        } as any;

        const result =
          await this.routeSheetGeneratorService.generateRouteSheetAndPersist(
            filters,
          );

        generatedCount++;
        results.push({
          vehicleId: vehicle.vehicle_id,
          vehicleName: vehicle.name,
          vehicleCode: vehicle.code,
          zoneIds,
          zoneNames,
          zones: zoneNames,
          drivers,
          assignedDriverId: effectiveDriverId ?? null,
          assignedDriverName,
          downloadUrl: result.downloadUrl,
        });
        this.logger.log(
          `✅ Hoja de ruta generada para vehículo ${vehicle.vehicle_id} (${zoneIds.length} zonas) → ${result.downloadUrl}`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Error generando hoja de ruta para vehículo ${vehicle.vehicle_id}:`,
          error,
        );
        // Resolver nombres de zonas para el resultado de error
        let zoneNames: string[] = [];
        try {
          if (zoneIds.length > 0) {
            const zs = await this.zone.findMany({
              where: { zone_id: { in: zoneIds } },
              select: { name: true },
            });
            zoneNames = zs.map((z) => z.name).filter(Boolean);
          }
        } catch (_) {
          zoneNames = [];
        }
        results.push({
          vehicleId: vehicle.vehicle_id,
          vehicleName: vehicle.name,
          vehicleCode: vehicle.code,
          zoneIds,
          zoneNames,
          zones: zoneNames,
          error: error.message,
        });
      }
    }

    return {
      success: true,
      message: `Generación de hojas de ruta completada: ${generatedCount}/${vehicles.length}`,
      date: dateIso,
      generated: generatedCount,
      totalVehicles: vehicles.length,
      results,
    };
  }

  /**
   * Ajusta la fecha para evitar domingos (genera el sábado anterior)
   */
  private adjustDateForSunday(date: Date): Date {
    const adjustedDate = new Date(date);

    // Si es domingo (0), retroceder al sábado anterior
    if (adjustedDate.getDay() === 0) {
      adjustedDate.setDate(adjustedDate.getDate() - 1);
      this.logger.log(
        `📅 Fecha ajustada de domingo a sábado: ${formatBAYMD(adjustedDate)}`,
      );
    }

    return adjustedDate;
  }

  /**
   * Obtiene los ciclos que vencen en la fecha especificada y necesitan pedido de cobranza
   */
  private async getCyclesDueForCollection(targetDate: Date) {
    return await this.subscription_cycle.findMany({
      where: {
        payment_due_date: {
          gte: startOfDayBA(targetDate),
          lt: new Date(
            startOfDayBA(targetDate).getTime() + 24 * 60 * 60 * 1000,
          ),
        },
        pending_balance: {
          gt: 0, // Solo ciclos con saldo pendiente
        },
        customer_subscription: {
          status: SubscriptionStatus.ACTIVE,
        },
      },
      include: {
        customer_subscription: {
          include: {
            person: true,
            subscription_plan: {
              include: {
                subscription_plan_product: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        customer_subscription: {
          person: {
            name: 'asc',
          },
        },
      },
    });
  }

  /**
   * Crea un nuevo pedido de cobranza o actualiza uno existente en la tabla collection_orders
   * @param cycle - Ciclo de suscripción
   * @param targetDate - Fecha objetivo para la cobranza
   * @param isAutomatic - Si es true, marca como automática (es_automatica=true), si es false, marca como manual (es_automatica=false)
   */
  private async createOrUpdateCollectionOrder(
    cycle: any,
    targetDate: Date,
    isAutomatic: boolean = true,
  ): Promise<CollectionOrderSummaryDto> {
    const person = cycle.customer_subscription.person;
    const subscription = cycle.customer_subscription;

    // Verificar si ya existe una orden de cobranza para este ciclo específico
    const existingCollectionOrder = await this.collection_orders.findFirst({
      where: {
        customer_id: person.person_id,
        subscription_id: subscription.subscription_id,
        notes: {
          contains: `Ciclo: ${cycle.cycle_id}`,
        },
        status: {
          in: [
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.IN_PREPARATION,
          ],
        },
      },
      include: {
        collection_order_items: true,
      },
    });

    let collectionOrderId: number;
    let orderCreated = false;

    if (existingCollectionOrder) {
      // Ya existe una orden de cobranza para este ciclo
      this.logger.log(
        `⚠️ Ya existe una orden de cobranza ${existingCollectionOrder.collection_order_id} para el ciclo ${cycle.cycle_id}`,
      );
      collectionOrderId = existingCollectionOrder.collection_order_id;
      orderCreated = false;
    } else {
      // Crear nueva orden de cobranza en collection_orders
      this.logger.log(
        `🆕 Creando nueva orden de cobranza ${isAutomatic ? 'automática' : 'manual'} para cliente ${person.name}`,
      );

      const collectionOrderType = isAutomatic ? 'AUTOMÁTICA' : 'MANUAL';
      const notes = `ORDEN DE COBRANZA ${collectionOrderType} - Suscripción: ${subscription.subscription_plan.name} - Ciclo: ${cycle.cycle_id} - Vencimiento: ${formatLocalYMD(targetDate)} - Monto a cobrar: $${cycle.pending_balance}`;

      try {
        const newCollectionOrder = await this.collection_orders.create({
          data: {
            customer_id: person.person_id,
            subscription_id: subscription.subscription_id,
            sale_channel_id: 1, // Canal por defecto para cobranzas
            order_date: targetDate,
            scheduled_delivery_date: targetDate,
            delivery_time: '09:00-18:00',
            total_amount: new Prisma.Decimal(cycle.pending_balance),
            paid_amount: new Prisma.Decimal(0),
            order_type: 'ONE_OFF', // Tipo de pedido para cobranzas
            status: 'PENDING',
            payment_status: 'PENDING',
            notes: notes,
            zone_id: person.zone_id,
            is_active: true,
            es_automatica: isAutomatic, // Campo clave para distinguir automáticas de manuales
          },
        });

        collectionOrderId = newCollectionOrder.collection_order_id;
        orderCreated = true;

        this.logger.log(
          `✅ Orden de cobranza ${collectionOrderType.toLowerCase()} creada: ID ${collectionOrderId} para ciclo ${cycle.cycle_id}, cliente ${person.name}, monto $${cycle.pending_balance}`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Error creando orden de cobranza para ciclo ${cycle.cycle_id}:`,
          error,
        );
        throw error;
      }
    }

    return {
      cycle_id: cycle.cycle_id,
      subscription_id: cycle.subscription_id,
      customer_id: person.person_id,
      customer_name: `${person.name ?? ''}`,
      subscription_plan_name: subscription.subscription_plan.name,
      payment_due_date: formatLocalYMD(targetDate),
      pending_balance: Number(cycle.pending_balance),
      order_created: orderCreated,
      order_id: collectionOrderId,
      notes: existingCollectionOrder
        ? 'Orden de cobranza ya existente'
        : `Nueva orden de cobranza ${isAutomatic ? 'automática' : 'manual'} creada`,
    };
  }

  /**
   * Método manual para generar pedidos de cobranza para una fecha específica
   */
  async generateCollectionOrdersForDate(
    targetDate: Date,
  ): Promise<CollectionOrderSummaryDto[]> {
    this.logger.log(
      `🔧 Generación de pedidos de cobranza (incluyendo recupero) para ${formatBAYMD(targetDate)}`,
    );

    const adjustedDate = this.adjustDateForSunday(targetDate);
    await this.applyLateFeesToOverdueCycles();

    // 1. Obtener ciclos que vencen específicamente en la fecha objetivo
    const cyclesDue = await this.getCyclesDueForCollection(adjustedDate);
    const results: CollectionOrderSummaryDto[] = [];

    for (const cycle of cyclesDue) {
      try {
        // Verificar si ya existe una orden de cobranza manual para este ciclo
        const hasManualOrder = await this.hasCollectionOrderForCycle(
          cycle.cycle_id,
        );

        if (hasManualOrder) {
          this.logger.log(
            `⚠️ Saltando ciclo ${cycle.cycle_id} - ya tiene una orden de cobranza manual`,
          );
          results.push({
            cycle_id: cycle.cycle_id,
            subscription_id: cycle.subscription_id,
            customer_id: cycle.customer_subscription.customer_id,
            customer_name: cycle.customer_subscription.person.name,
            subscription_plan_name:
              cycle.customer_subscription.subscription_plan.name,
            payment_due_date: formatBAYMD(cycle.payment_due_date || new Date()),
            pending_balance: Number(cycle.pending_balance),
            order_created: false,
            notes:
              'Ciclo ya tiene orden de cobranza manual - no se genera automática',
          });
          continue;
        }

        const result = await this.createOrUpdateCollectionOrder(
          cycle,
          adjustedDate,
          true, // isAutomatic = true para cobranzas automáticas
        );
        results.push(result);
      } catch (error) {
        this.logger.error(
          `❌ Error procesando ciclo ${cycle.cycle_id}:`,
          error,
        );
        results.push({
          cycle_id: cycle.cycle_id,
          subscription_id: cycle.subscription_id,
          customer_id: cycle.customer_subscription.customer_id,
          customer_name: cycle.customer_subscription.person.name,
          subscription_plan_name:
            cycle.customer_subscription.subscription_plan.name,
          payment_due_date: formatBAYMD(cycle.payment_due_date || new Date()),
          pending_balance: Number(cycle.pending_balance),
          order_created: false,
          notes: `Error: ${error.message}`,
        });
      }
    }

    // 2. Ejecutar Backfill para capturar cualquier orden perdida de días anteriores
    // Esto cubre ciclos con fecha de vencimiento <= targetDate (startOfDay)
    // que podrían no haber sido capturados por getCyclesDueForCollection (que busca un rango específico del día)
    try {
      const backfill =
        await this.backfillMissingCollectionOrdersUpToDate(targetDate);

      // Fusionar resultados evitando duplicados
      const processedCycleIds = new Set(results.map((r) => r.cycle_id));

      if (backfill.details) {
        for (const item of backfill.details) {
          if (!processedCycleIds.has(item.cycle_id)) {
            results.push(item);
            processedCycleIds.add(item.cycle_id);
          }
        }
      }

      this.logger.log(
        `🔄 Proceso completado: ${results.length} ciclos procesados (Día: ${cyclesDue.length}, Backfill: ${backfill.generated})`,
      );
    } catch (error) {
      this.logger.error('❌ Error ejecutando backfill automático:', error);
      // No interrumpimos el proceso principal si falla el backfill, pero lo registramos
    }

    return results;
  }

  async backfillMissingCollectionOrdersUpToDate(targetDate: Date): Promise<{
    date: string;
    generated: number;
    checked: number;
    details: CollectionOrderSummaryDto[];
  }> {
    const adjustedDate = this.adjustDateForSunday(targetDate);
    await this.applyLateFeesToOverdueCycles();

    const cycles = await this.subscription_cycle.findMany({
      where: {
        payment_due_date: { lte: startOfDayBA(adjustedDate) },
        pending_balance: { gt: 0 },
        customer_subscription: { status: SubscriptionStatus.ACTIVE },
      },
      include: {
        customer_subscription: {
          include: { person: true, subscription_plan: true },
        },
      },
      orderBy: { payment_due_date: 'asc' },
    });

    const results: CollectionOrderSummaryDto[] = [];
    const createdCount = 0;

    for (const cycle of cycles) {
      const exists = await this.hasCollectionOrderForCycle(cycle.cycle_id);
      if (exists) {
        results.push({
          cycle_id: cycle.cycle_id,
          subscription_id: cycle.subscription_id,
          customer_id: cycle.customer_subscription.customer_id,
          customer_name: cycle.customer_subscription.person.name,
          subscription_plan_name:
            cycle.customer_subscription.subscription_plan.name,
          payment_due_date: formatBAYMD(cycle.payment_due_date || new Date()),
          pending_balance: Number(cycle.pending_balance),
          order_created: false,
          notes: 'Orden existente, no se duplica',
        });
        continue;
      }

      const orderDate = this.adjustDateForSunday(
        cycle.payment_due_date || adjustedDate,
      );
      const result = await this.createOrUpdateCollectionOrder(
        cycle,
        orderDate,
        true,
      );
      results.push(result);
    }

    return {
      date: formatBAYMD(adjustedDate),
      generated: createdCount,
      checked: cycles.length,
      details: results,
    };
  }

  async prepareConsolidatedRouteSheetForCollections(
    targetDate: Date,
    opts?: {
      zoneIds?: number[];
      vehicleId?: number;
      driverId?: number;
      notes?: string;
    },
  ): Promise<RouteSheetResponseDto> {
    const adjustedDate = this.adjustDateForSunday(targetDate);
    const dto: GenerateRouteSheetDto = {
      date: formatBAYMD(adjustedDate),
      overdueOnly: 'false',
      sortBy: 'zone',
      format: 'compact',
      zoneIds: opts?.zoneIds,
      vehicleId: opts?.vehicleId,
      driverId: opts?.driverId,
      notes: opts?.notes,
    } as any;
    return await this.routeSheetGeneratorService.generateRouteSheet(dto);
  }

  /**
   * Genera una orden de cobranza manual para un ciclo específico
   * @param cycleId - ID del ciclo de suscripción
   * @param targetDate - Fecha objetivo para la cobranza
   * @param createHybridOrder - Si debe crear también un pedido híbrido
   */
  async generateManualCollectionOrder(
    cycleId: number,
    targetDate: Date,
    createHybridOrder: boolean = false,
  ): Promise<CollectionOrderSummaryDto> {
    // Obtener información del ciclo
    const cycle = await this.subscription_cycle.findUnique({
      where: { cycle_id: cycleId },
      include: {
        customer_subscription: {
          include: {
            person: true,
            subscription_plan: true,
          },
        },
      },
    });

    if (!cycle) {
      throw new Error(`Ciclo de suscripción con ID ${cycleId} no encontrado`);
    }

    // Verificar que el ciclo tenga saldo pendiente
    const pendingBalance = new Prisma.Decimal(cycle.pending_balance || 0);
    if (pendingBalance.lessThanOrEqualTo(0)) {
      throw new Error(
        `El ciclo ${cycleId} no tiene saldo pendiente por cobrar. Saldo actual: $${pendingBalance.toString()}`,
      );
    }

    // Crear la orden de cobranza manual
    const result = await this.createOrUpdateCollectionOrder(
      cycle,
      targetDate,
      false, // isAutomatic = false para cobranzas manuales
    );

    // Si se solicita, crear también un pedido híbrido
    if (createHybridOrder && result.order_created) {
      try {
        await this.createHybridOrderForManualCollection(cycle, targetDate);
        this.logger.log(
          `✅ Pedido híbrido creado para la orden de cobranza manual ${result.order_id}`,
        );
      } catch (error) {
        this.logger.warn(
          `⚠️ No se pudo crear el pedido híbrido para la orden de cobranza manual ${result.order_id}: ${error.message}`,
        );
      }
    }

    return result;
  }

  /**
   * Crea un pedido híbrido para una cobranza manual
   * @param cycle - Ciclo de suscripción
   * @param targetDate - Fecha objetivo
   */
  private async createHybridOrderForManualCollection(
    cycle: any,
    targetDate: Date,
  ): Promise<void> {
    const person = cycle.customer_subscription.person;
    const subscription = cycle.customer_subscription;

    // Crear un pedido híbrido básico sin productos adicionales
    const createOrderDto: CreateOrderDto = {
      customer_id: person.person_id,
      subscription_id: subscription.subscription_id,
      sale_channel_id: 1,
      order_date: formatBATimestampISO(targetDate),
      scheduled_delivery_date: formatBATimestampISO(targetDate),
      delivery_time: '09:00-18:00',
      total_amount: '0.00', // Pedido híbrido sin productos adicionales
      paid_amount: '0.00',
      order_type: 'HYBRID' as any,
      status: 'PENDING' as any,
      notes: `PEDIDO HÍBRIDO PARA COBRANZA MANUAL - Suscripción: ${subscription.subscription_plan.name} - Ciclo: ${cycle.cycle_id}`,
      items: [], // Solo productos de la suscripción, sin adicionales
    };

    await this.ordersService.create(createOrderDto);
  }

  /**
   * Verifica si un ciclo ya tiene una orden de cobranza (automática o manual)
   * @param cycleId - ID del ciclo
   */
  async hasCollectionOrderForCycle(cycleId: number): Promise<boolean> {
    const existingOrder = await this.collection_orders.findFirst({
      where: {
        notes: {
          contains: `Ciclo: ${cycleId}`,
        },
        status: {
          in: [
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.IN_PREPARATION,
          ],
        },
      },
    });

    return !!existingOrder;
  }

  /**
   * Obtiene un resumen de los ciclos que requieren cobranza en los próximos días
   */
  async getUpcomingCollections(
    days: number = 7,
  ): Promise<CollectionOrderSummaryDto[]> {
    const today = startOfDayBA(new Date());
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + days);

    const upcomingCycles = await this.subscription_cycle.findMany({
      where: {
        payment_due_date: {
          gte: today,
          lte: endDate,
        },
        pending_balance: {
          gt: 0,
        },
        customer_subscription: {
          status: SubscriptionStatus.ACTIVE,
        },
      },
      include: {
        customer_subscription: {
          include: {
            person: true,
            subscription_plan: true,
          },
        },
      },
      orderBy: {
        payment_due_date: 'asc',
      },
    });

    return upcomingCycles.map((cycle) => ({
      cycle_id: cycle.cycle_id,
      subscription_id: cycle.subscription_id,
      customer_id: cycle.customer_subscription.customer_id,
      customer_name: cycle.customer_subscription.person.name,
      subscription_plan_name:
        cycle.customer_subscription.subscription_plan.name,
      payment_due_date: formatBAYMD(cycle.payment_due_date || new Date()),
      pending_balance: Number(cycle.pending_balance),
      order_created: false, // Se determinará al momento de la generación
      notes: 'Pendiente de generación automática',
    }));
  }

  /**
   * Lista las cobranzas automáticas con filtros y paginación
   */
  async listAutomatedCollections(
    filters: FilterAutomatedCollectionsDto,
  ): Promise<AutomatedCollectionListResponseDto> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    // Construir filtros dinámicos
    const whereClause: any = {
      order_type: 'ONE_OFF',
      notes: {
        contains: 'COBRANZA AUTOMÁTICA',
      },
    };

    // Filtros de fecha (creación de orden)
    if (filters.orderDateFrom || filters.orderDateTo) {
      whereClause.order_date = {};
      if (filters.orderDateFrom) {
        const raw = String(filters.orderDateFrom).trim();
        whereClause.order_date.gte = /^\d{4}-\d{2}-\d{2}$/.test(raw)
          ? parseYMD(raw)
          : new Date(filters.orderDateFrom);
      }
      if (filters.orderDateTo) {
        const raw = String(filters.orderDateTo).trim();
        const endDate = /^\d{4}-\d{2}-\d{2}$/.test(raw)
          ? parseYMD(raw)
          : new Date(filters.orderDateTo);
        endDate.setHours(23, 59, 59, 999);
        whereClause.order_date.lte = endDate;
      }
    }

    // Construir filtros para subscription_cycle (due dates / overdue)
    const subscriptionCycleSome: any = {};
    if (filters.dueDateFrom || filters.dueDateTo) {
      subscriptionCycleSome.payment_due_date =
        subscriptionCycleSome.payment_due_date || {};
      if (filters.dueDateFrom) {
        const raw = String(filters.dueDateFrom).trim();
        subscriptionCycleSome.payment_due_date.gte = /^\d{4}-\d{2}-\d{2}$/.test(
          raw,
        )
          ? parseYMD(raw)
          : new Date(filters.dueDateFrom);
      }
      if (filters.dueDateTo) {
        const raw = String(filters.dueDateTo).trim();
        const dueEndDate = /^\d{4}-\d{2}-\d{2}$/.test(raw)
          ? parseYMD(raw)
          : new Date(filters.dueDateTo);
        dueEndDate.setHours(23, 59, 59, 999);
        subscriptionCycleSome.payment_due_date.lte = dueEndDate;
      }
    }

    // Filtros de estado
    if (filters.statuses && filters.statuses.length > 0) {
      whereClause.status = { in: filters.statuses };
    }

    if (filters.paymentStatuses && filters.paymentStatuses.length > 0) {
      whereClause.payment_status = { in: filters.paymentStatuses };
    }

    // Filtros de cliente
    if (filters.customerIds && filters.customerIds.length > 0) {
      whereClause.customer_id = { in: filters.customerIds };
    }

    if (filters.customerName) {
      whereClause.customer = {
        ...(whereClause.customer || {}),
        name: {
          contains: filters.customerName,
          mode: 'insensitive',
        },
      };
    }

    // Filtro de búsqueda general
    if (filters.search) {
      whereClause.OR = [
        {
          customer: {
            name: {
              contains: filters.search,
              mode: 'insensitive',
            },
          },
        },
        {
          collection_order_id: {
            equals: isNaN(parseInt(filters.search))
              ? undefined
              : parseInt(filters.search),
          },
        },
        {
          notes: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Filtro de ID específico
    if (filters.orderId) {
      whereClause.collection_order_id = filters.orderId;
    }

    // Filtros de monto
    if (filters.minAmount || filters.maxAmount) {
      whereClause.total_amount = {};
      if (filters.minAmount) {
        whereClause.total_amount.gte = new Prisma.Decimal(filters.minAmount);
      }
      if (filters.maxAmount) {
        whereClause.total_amount.lte = new Prisma.Decimal(filters.maxAmount);
      }
    }

    // Filtro de vencidas
    if (filters.overdue === 'true') {
      const today = startOfDayBA(new Date());

      subscriptionCycleSome.payment_due_date =
        subscriptionCycleSome.payment_due_date || {};
      subscriptionCycleSome.payment_due_date.lt = today;
      subscriptionCycleSome.pending_balance = { gt: 0 };

      // Mantener compatibilidad con estados de pago del pedido
      whereClause.AND = [
        {
          OR: [{ payment_status: 'PENDING' }, { payment_status: 'OVERDUE' }],
        },
      ];
    }

    // Aplicar filtros combinados de subscription_cycle si corresponde
    if (Object.keys(subscriptionCycleSome).length > 0) {
      whereClause.customer_subscription = {
        ...(whereClause.customer_subscription || {}),
        subscription_cycle: {
          some: subscriptionCycleSome,
        },
      };
    }

    // Filtro por zonas (IDs de zonas del cliente)
    if (filters.zoneIds && filters.zoneIds.length > 0) {
      whereClause.customer = {
        ...(whereClause.customer || {}),
        zone_id: { in: filters.zoneIds },
      };
    }

    // Filtro por plan de suscripción
    if (typeof filters.subscriptionPlanId === 'number') {
      whereClause.customer_subscription = {
        ...(whereClause.customer_subscription || {}),
        subscription_plan_id: filters.subscriptionPlanId,
      };
    }

    // Ordenamiento
    const orderBy: any = {};
    if (filters.sortBy) {
      const sortFields = filters.sortBy.split(',');
      sortFields.forEach((field) => {
        const isDesc = field.startsWith('-');
        const fieldName = isDesc ? field.substring(1) : field;
        const direction = isDesc ? 'desc' : 'asc';

        switch (fieldName) {
          case 'createdAt':
            // collection_orders no tiene created_at; usar order_date
            orderBy.order_date = direction;
            break;
          case 'orderDate':
            orderBy.order_date = direction;
            break;
          case 'amount':
            orderBy.total_amount = direction;
            break;
          case 'customer':
            orderBy.customer = { name: direction };
            break;
          default:
            orderBy.order_date = 'desc';
        }
      });
    } else {
      orderBy.order_date = 'desc';
    }

    // Ejecutar consultas contra collection_orders (no order_header)
    const [orders, total] = await Promise.all([
      this.collection_orders.findMany({
        where: whereClause,
        include: {
          customer: {
            include: {
              zone: true,
            },
          },
          customer_subscription: {
            include: {
              subscription_plan: true,
              subscription_cycle: {
                where: {
                  pending_balance: { gt: 0 },
                },
                orderBy: {
                  payment_due_date: 'desc',
                },
                take: 1,
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.collection_orders.count({ where: whereClause }),
    ]);

    // Transformar datos
    const data: AutomatedCollectionResponseDto[] = orders.map((order) => {
      const today = new Date();
      const dueDate =
        order.customer_subscription?.subscription_cycle?.[0]?.payment_due_date;
      const isOverdue = dueDate ? dueDate < today : false;
      const daysOverdue =
        isOverdue && dueDate
          ? Math.floor(
              (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
            )
          : 0;

      const pendingAmount =
        parseFloat(order.total_amount.toString()) -
        parseFloat(order.paid_amount.toString());

      const result: AutomatedCollectionResponseDto = {
        order_id: order.collection_order_id ?? order.order_id,
        order_date: order.order_date
          ? formatBATimestampISO(order.order_date)
          : '',
        due_date: dueDate ? formatBATimestampISO(dueDate) : null,
        total_amount: order.total_amount.toString(),
        paid_amount: order.paid_amount.toString(),
        pending_amount: pendingAmount.toFixed(2),
        status: order.status as OrderStatus,
        payment_status: order.payment_status,
        notes: order.notes,
        is_overdue: isOverdue,
        days_overdue: daysOverdue,
        customer: {
          customer_id: order.customer_id,
          name: order.customer.name,
          document_number: order.customer.document_number,
          phone: order.customer.phone,
          email: order.customer.email,
          address: order.customer.address,
          zone: order.customer.zone
            ? {
                zone_id: order.customer.zone.zone_id,
                name: order.customer.zone.name,
              }
            : null,
        },
        subscription_info: order.customer_subscription
          ? {
              subscription_id: order.customer_subscription.subscription_id,
              subscription_plan: {
                subscription_plan_id:
                  order.customer_subscription.subscription_plan
                    .subscription_plan_id,
                name: order.customer_subscription.subscription_plan.name,
                price:
                  order.customer_subscription.subscription_plan.price.toString(),
                billing_frequency:
                  order.customer_subscription.subscription_plan
                    .billing_frequency,
              },
              cycle_info: order.customer_subscription.subscription_cycle?.[0]
                ? {
                    cycle_id:
                      order.customer_subscription.subscription_cycle[0]
                        .cycle_id,
                    cycle_number:
                      order.customer_subscription.subscription_cycle[0]
                        .cycle_number,
                    start_date: formatBATimestampISO(
                      order.customer_subscription.subscription_cycle[0]
                        .start_date,
                    ),
                    end_date: formatBATimestampISO(
                      order.customer_subscription.subscription_cycle[0]
                        .end_date,
                    ),
                    due_date: formatBATimestampISO(
                      order.customer_subscription.subscription_cycle[0]
                        .payment_due_date,
                    ),
                    pending_balance:
                      order.customer_subscription.subscription_cycle[0].pending_balance.toString(),
                  }
                : null,
            }
          : null,
        created_at: order.order_date
          ? formatBATimestampISO(order.order_date)
          : '',
        updated_at: order.order_date
          ? formatBATimestampISO(order.order_date)
          : '',
      };

      return result;
    });

    // Calcular resumen
    const summary = {
      total_amount: orders
        .reduce(
          (sum, order) => sum + parseFloat(order.total_amount.toString()),
          0,
        )
        .toFixed(2),
      total_paid: orders
        .reduce(
          (sum, order) => sum + parseFloat(order.paid_amount.toString()),
          0,
        )
        .toFixed(2),
      total_pending: orders
        .reduce((sum, order) => {
          const pending =
            parseFloat(order.total_amount.toString()) -
            parseFloat(order.paid_amount.toString());
          return sum + pending;
        }, 0)
        .toFixed(2),
      overdue_amount: data
        .filter((d) => d.is_overdue)
        .reduce((sum, d) => sum + parseFloat(d.pending_amount), 0)
        .toFixed(2),
      overdue_count: data.filter((d) => d.is_overdue).length,
    };

    // Información de paginación
    const totalPages = Math.ceil(total / limit);
    const pagination = {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    return {
      data,
      pagination,
      summary,
    };
  }

  /**
   * Obtiene los detalles de una cobranza automática específica
   */
  async getAutomatedCollectionById(
    orderId: number,
  ): Promise<AutomatedCollectionResponseDto> {
    const order = await this.collection_orders.findFirst({
      where: {
        collection_order_id: orderId,
        order_type: 'ONE_OFF',
        notes: {
          contains: 'COBRANZA AUTOMÁTICA',
        },
      },
      include: {
        customer: {
          include: {
            zone: true,
          },
        },
        customer_subscription: {
          include: {
            subscription_plan: true,
            subscription_cycle: {
              where: {
                pending_balance: { gt: 0 },
              },
              orderBy: {
                payment_due_date: 'desc',
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!order) {
      throw new Error(`Cobranza automática con ID ${orderId} no encontrada`);
    }

    const today = new Date();
    const dueDate =
      order.customer_subscription?.subscription_cycle?.[0]?.payment_due_date;
    const isOverdue = dueDate ? dueDate < today : false;
    const daysOverdue =
      isOverdue && dueDate
        ? Math.floor(
            (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 0;

    const pendingAmount =
      parseFloat(order.total_amount.toString()) -
      parseFloat(order.paid_amount.toString());

    const result: AutomatedCollectionResponseDto = {
      order_id: order.collection_order_id ?? order.order_id,
      order_date: order.order_date
        ? formatBATimestampISO(order.order_date)
        : '',
      due_date: dueDate ? formatBATimestampISO(dueDate) : null,
      total_amount: order.total_amount.toString(),
      paid_amount: order.paid_amount.toString(),
      pending_amount: pendingAmount.toFixed(2),
      status: order.status as OrderStatus,
      payment_status: order.payment_status,
      notes: order.notes,
      is_overdue: isOverdue,
      days_overdue: daysOverdue,
      customer: {
        customer_id: order.customer_id,
        name: order.customer.name,
        document_number: order.customer.document_number,
        phone: order.customer.phone,
        email: order.customer.email,
        address: order.customer.address,
        zone: order.customer.zone
          ? {
              zone_id: order.customer.zone.zone_id,
              name: order.customer.zone.name,
            }
          : null,
      },
      subscription_info: order.customer_subscription
        ? {
            subscription_id: order.customer_subscription.subscription_id,
            subscription_plan: {
              subscription_plan_id:
                order.customer_subscription.subscription_plan
                  .subscription_plan_id,
              name: order.customer_subscription.subscription_plan.name,
              price:
                order.customer_subscription.subscription_plan.price.toString(),
              billing_frequency:
                order.customer_subscription.subscription_plan.billing_frequency,
            },
            cycle_info: order.customer_subscription.subscription_cycle?.[0]
              ? {
                  cycle_id:
                    order.customer_subscription.subscription_cycle[0].cycle_id,
                  cycle_number:
                    order.customer_subscription.subscription_cycle[0]
                      .cycle_number,
                  start_date: formatBATimestampISO(
                    order.customer_subscription.subscription_cycle[0]
                      .start_date,
                  ),
                  end_date: formatBATimestampISO(
                    order.customer_subscription.subscription_cycle[0].end_date,
                  ),
                  due_date: formatBATimestampISO(
                    order.customer_subscription.subscription_cycle[0]
                      .payment_due_date,
                  ),
                  pending_balance:
                    order.customer_subscription.subscription_cycle[0].pending_balance.toString(),
                }
              : null,
          }
        : null,
      created_at: order.order_date
        ? formatBATimestampISO(order.order_date)
        : '',
      updated_at: order.order_date
        ? formatBATimestampISO(order.order_date)
        : '',
    };

    return result;
  }

  /**
   * Elimina lógicamente una cobranza automática
   */
  async deleteAutomatedCollection(
    orderId: number,
  ): Promise<DeleteAutomatedCollectionResponseDto> {
    const order = await this.collection_orders.findFirst({
      where: {
        collection_order_id: orderId,
        order_type: 'ONE_OFF',
        notes: {
          contains: 'COBRANZA AUTOMÁTICA',
        },
      },
      include: {
        customer: true,
      },
    });

    if (!order) {
      throw new Error(`Cobranza automática con ID ${orderId} no encontrada`);
    }

    // Verificar si tiene pagos
    const hasPaidAmount = parseFloat(order.paid_amount.toString()) > 0;
    if (hasPaidAmount) {
      throw new Error(
        'No se puede eliminar una cobranza que ya tiene pagos registrados',
      );
    }

    // Eliminar lógicamente (cambiar estado)
    await this.collection_orders.update({
      where: { collection_order_id: orderId },
      data: {
        status: 'CANCELLED',
        notes: `${order.notes} - ELIMINADO LÓGICAMENTE`,
      },
    });

    const pendingAmount =
      parseFloat(order.total_amount.toString()) -
      parseFloat(order.paid_amount.toString());

    return {
      success: true,
      message: 'Cobranza automática eliminada exitosamente',
      deletedOrderId: orderId,
      deletedAt: formatBATimestampISO(new Date()),
      deletionInfo: {
        was_paid: hasPaidAmount,
        had_pending_amount: pendingAmount.toFixed(2),
        customer_name: order.customer.name,
        deletion_type: 'logical',
      },
    };
  }

  /**
   * Genera un PDF con el reporte de cobranzas automáticas
   */
  async generatePdfReport(
    filters: GeneratePdfCollectionsDto,
  ): Promise<PdfGenerationResponseDto> {
    try {
      // Obtener datos para el reporte
      const filterDto: FilterAutomatedCollectionsDto = {
        orderDateFrom: filters.dateFrom,
        orderDateTo: filters.dateTo,
        dueDateFrom: filters.dueDateFrom,
        dueDateTo: filters.dueDateTo,
        statuses: filters.statuses,
        paymentStatuses: filters.paymentStatuses,
        customerIds: filters.customerIds,
        zoneIds: filters.zoneIds,
        overdue: filters.overdueOnly,
        minAmount: filters.minAmount,
        maxAmount: filters.maxAmount,
        page: 1,
        limit: 10000, // Obtener todos los registros para el PDF
      };

      const collectionsData = await this.listAutomatedCollections(filterDto);

      // Usar el servicio de generación de PDFs
      return await this.pdfGeneratorService.generateCollectionReportPdf(
        filters,
        collectionsData,
      );
    } catch (error) {
      this.logger.error('Error generando PDF:', error);
      throw new Error(`Error generando PDF: ${error.message}`);
    }
  }

  /**
   * Genera una hoja de ruta para cobranzas
   */
  async generateRouteSheet(
    filters: GenerateRouteSheetDto,
  ): Promise<RouteSheetResponseDto> {
    try {
      // Usar el servicio de generación de hojas de ruta
      return await this.routeSheetGeneratorService.generateRouteSheet(filters);
    } catch (error) {
      this.logger.error('Error generando hoja de ruta:', error);
      throw new Error(`Error generando hoja de ruta: ${error.message}`);
    }
  }
}
