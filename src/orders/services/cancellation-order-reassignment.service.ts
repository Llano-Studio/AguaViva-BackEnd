import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient, CancellationOrderStatus } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CancellationOrderService } from '../cancellation-order.service';

@Injectable()
export class CancellationOrderReassignmentService
  extends PrismaClient
  implements OnModuleInit
{
  private readonly logger = new Logger(
    CancellationOrderReassignmentService.name,
  );

  constructor(
    private readonly cancellationOrderService: CancellationOrderService,
  ) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('CancellationOrderReassignmentService initialized');
  }

  /**
   * Ejecuta la reasignación automática de órdenes de cancelación fallidas cada día a las 3 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async reassignFailedCancellationOrders() {
    this.logger.log(
      '🔄 Iniciando reasignación automática de órdenes de cancelación fallidas...',
    );

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Buscar órdenes de cancelación con estado FAILED de días anteriores
      const failedCancellationOrders = await this.cancellation_order.findMany({
        where: {
          status: CancellationOrderStatus.CANCELLED,
          scheduled_collection_date: {
            lt: today, // Órdenes programadas para días anteriores
          },
          rescheduled_count: {
            lt: 3, // Máximo 3 intentos de reprogramación
          },
        },
        include: {
          customer_subscription: {
            include: {
              person: {
                include: {
                  zone: true,
                },
              },
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
          route_sheet: {
            include: {
              driver: true,
              vehicle: true,
            },
          },
        },
      });

      this.logger.log(
        `📊 Encontradas ${failedCancellationOrders.length} órdenes de cancelación fallidas para reasignar`,
      );

      let reassignedCount = 0;
      let failedReassignments = 0;

      for (const failedOrder of failedCancellationOrders) {
        try {
          await this.processFailedCancellationOrder(failedOrder);
          reassignedCount++;
        } catch (error) {
          failedReassignments++;
          this.logger.error(
            `❌ Error procesando orden de cancelación fallida ${failedOrder.cancellation_order_id}:`,
            error,
          );
        }
      }

      this.logger.log(
        `✅ Reasignación automática completada: ${reassignedCount} exitosas, ${failedReassignments} fallidas`,
      );

      return { reassignedCount, failedReassignments };
    } catch (error) {
      this.logger.error(
        '❌ Error durante la reasignación automática de órdenes de cancelación fallidas:',
        error,
      );
      throw error;
    }
  }

  /**
   * Procesa una orden de cancelación fallida individual
   */
  private async processFailedCancellationOrder(failedOrder: any) {
    try {
      // Calcular la nueva fecha de recolección (siguiente día hábil)
      const newCollectionDate = this.getNextBusinessDay(new Date());

      // Buscar una hoja de ruta existente para la nueva fecha en la zona del cliente
      let targetRouteSheet = await this.findAvailableRouteSheet(
        newCollectionDate,
        failedOrder.subscription?.customer?.zone?.zone_id,
      );

      // Si no existe una hoja de ruta para esa fecha, crear una nueva
      if (!targetRouteSheet) {
        targetRouteSheet = await this.createNewRouteSheetForCancellation(
          newCollectionDate,
          failedOrder.subscription?.customer?.zone?.zone_id,
        );
      }

      // Reasignar la orden de cancelación a la nueva hoja de ruta
      await this.reassignCancellationOrder(
        failedOrder,
        targetRouteSheet,
        newCollectionDate,
      );

      this.logger.log(
        `✅ Orden de cancelación reasignada: ${failedOrder.cancellation_order_id} ` +
          `de ${failedOrder.scheduled_collection_date.toISOString().split('T')[0]} ` +
          `a ${newCollectionDate.toISOString().split('T')[0]}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error procesando orden de cancelación fallida ${failedOrder.cancellation_order_id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Busca una hoja de ruta disponible para la fecha y zona especificadas
   */
  private async findAvailableRouteSheet(deliveryDate: Date, zoneId?: number) {
    const whereClause: any = {
      delivery_date: deliveryDate,
    };

    // Si se especifica una zona, buscar vehículos que operen en esa zona
    if (zoneId) {
      whereClause.vehicle = {
        vehicle_zone: {
          some: {
            zone_id: zoneId,
            is_active: true,
          },
        },
      };
    }

    return await this.route_sheet.findFirst({
      where: whereClause,
      include: {
        driver: true,
        vehicle: true,
        route_sheet_detail: true,
      },
    });
  }

  /**
   * Crea una nueva hoja de ruta para órdenes de cancelación
   */
  private async createNewRouteSheetForCancellation(
    deliveryDate: Date,
    zoneId?: number,
  ) {
    // Buscar un conductor y vehículo disponible, preferiblemente en la zona especificada
    const whereClause: any = {
      role: 'DRIVERS',
      isActive: true,
      user_vehicle: {
        some: {
          is_active: true,
        },
      },
    };

    if (zoneId) {
      whereClause.user_vehicle.some.vehicle = {
        vehicle_zone: {
          some: {
            zone_id: zoneId,
            is_active: true,
          },
        },
      };
    }

    const availableDriver = (await this.user.findFirst({
      where: whereClause,
      include: {
        user_vehicle: {
          where: { is_active: true },
          include: {
            vehicle: {
              include: {
                vehicle_zone: {
                  where: { is_active: true },
                  include: {
                    zone: true,
                  },
                },
              },
            },
          },
        },
      },
    })) as any;

    if (!availableDriver || !availableDriver.user_vehicle[0]) {
      throw new Error(
        'No hay conductores o vehículos disponibles para crear nueva hoja de ruta de cancelación',
      );
    }

    const vehicle = availableDriver.user_vehicle[0].vehicle;

    return await this.route_sheet.create({
      data: {
        delivery_date: deliveryDate,
        driver_id: availableDriver.id,
        vehicle_id: vehicle.vehicle_id,
        route_notes:
          'Hoja de ruta creada automáticamente para reasignación de órdenes de cancelación fallidas',
      },
      include: {
        driver: true,
        vehicle: true,
        route_sheet_detail: true,
      },
    });
  }

  /**
   * Reasigna la orden de cancelación fallida a una nueva hoja de ruta
   */
  private async reassignCancellationOrder(
    failedOrder: any,
    targetRouteSheet: any,
    newCollectionDate: Date,
  ) {
    await this.$transaction(async (tx) => {
      // Actualizar la orden de cancelación con la nueva fecha y hoja de ruta
      await tx.cancellation_order.update({
        where: { cancellation_order_id: failedOrder.cancellation_order_id },
        data: {
          scheduled_collection_date: newCollectionDate,
          route_sheet_id: targetRouteSheet.route_sheet_id,
          status: CancellationOrderStatus.SCHEDULED,
          rescheduled_count: (failedOrder.rescheduled_count || 0) + 1,
          notes:
            (failedOrder.notes || '') +
            ` | Reprogramado automáticamente el ${new Date().toISOString().split('T')[0]}`,
        },
      });

      // Las órdenes de cancelación se relacionan directamente con route_sheet
      // No necesitan entrada en route_sheet_detail ya que no tienen ese campo
    });
  }

  /**
   * Calcula el siguiente día hábil (lunes a viernes)
   */
  private getNextBusinessDay(date: Date): Date {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // Si es sábado (6) o domingo (0), avanzar al lunes
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
      nextDay.setDate(nextDay.getDate() + 1);
    }

    return nextDay;
  }

  /**
   * Método manual para forzar la reasignación de órdenes de cancelación fallidas
   */
  async forceReassignmentCheck() {
    this.logger.log(
      '🔧 Ejecutando reasignación manual de órdenes de cancelación fallidas...',
    );
    return await this.reassignFailedCancellationOrders();
  }

  /**
   * Obtiene estadísticas de órdenes de cancelación fallidas
   */
  async getFailedCancellationOrdersStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const failedCount = await this.cancellation_order.count({
      where: {
        status: CancellationOrderStatus.CANCELLED,
        scheduled_collection_date: {
          lt: today,
        },
        rescheduled_count: {
          lt: 3,
        },
      },
    });

    const maxRetriesReached = await this.cancellation_order.count({
      where: {
        status: CancellationOrderStatus.CANCELLED,
        rescheduled_count: {
          gte: 3,
        },
      },
    });

    const rescheduledToday = await this.cancellation_order.count({
      where: {
        rescheduled_count: {
          gt: 0,
        },
        updated_at: {
          gte: today,
        },
      },
    });

    return {
      pending_reassignment: failedCount,
      max_retries_reached: maxRetriesReached,
      rescheduled_today: rescheduledToday,
      total_failed: failedCount + maxRetriesReached,
    };
  }

  /**
   * Marca una orden de cancelación como fallida
   */
  async markCancellationOrderAsFailed(
    cancellationOrderId: number,
    reason?: string,
  ) {
    return await this.cancellation_order.update({
      where: { cancellation_order_id: cancellationOrderId },
      data: {
        status: CancellationOrderStatus.CANCELLED,
        notes:
          (
            await this.cancellation_order.findUnique({
              where: { cancellation_order_id: cancellationOrderId },
              select: { notes: true },
            })
          )?.notes +
          ` | Marcado como fallido: ${reason || 'Sin razón especificada'}`,
      },
    });
  }
}