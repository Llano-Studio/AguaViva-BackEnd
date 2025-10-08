import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient, Prisma, SubscriptionStatus } from '@prisma/client';
import { OrderType, OrderStatus } from '../../common/constants/enums';
import { OrdersService } from '../../orders/orders.service';
import { CreateOrderDto } from '../../orders/dto/create-order.dto';
import {
  OrderCollectionEditService,
  CollectionItemDto,
} from './order-collection-edit.service';

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
    private readonly orderCollectionEditService: OrderCollectionEditService,
  ) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Ejecuta la generación automática de pedidos de cobranza todos los días a las 6 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async generateCollectionOrders() {
    this.logger.log(
      '🔄 Iniciando generación automática de pedidos de cobranza...',
    );

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Ajustar fecha si es domingo (generar el sábado anterior)
      const targetDate = this.adjustDateForSunday(today);

      // Buscar ciclos que vencen hoy y necesitan pedido de cobranza
      const cyclesDueToday = await this.getCyclesDueForCollection(targetDate);

      this.logger.log(
        `📊 Encontrados ${cyclesDueToday.length} ciclos que requieren pedido de cobranza para ${targetDate.toISOString().split('T')[0]}`,
      );

      const results: CollectionOrderSummaryDto[] = [];

      for (const cycle of cyclesDueToday) {
        try {
          const result = await this.createOrUpdateCollectionOrder(
            cycle,
            targetDate,
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
            payment_due_date:
              cycle.payment_due_date?.toISOString().split('T')[0] || '',
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
   * Ajusta la fecha para evitar domingos (genera el sábado anterior)
   */
  private adjustDateForSunday(date: Date): Date {
    const adjustedDate = new Date(date);

    // Si es domingo (0), retroceder al sábado anterior
    if (adjustedDate.getDay() === 0) {
      adjustedDate.setDate(adjustedDate.getDate() - 1);
      this.logger.log(
        `📅 Fecha ajustada de domingo a sábado: ${adjustedDate.toISOString().split('T')[0]}`,
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
          gte: targetDate,
          lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000), // Hasta el final del día
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
   * Crea un nuevo pedido de cobranza o actualiza uno existente
   */
  private async createOrUpdateCollectionOrder(
    cycle: any,
    targetDate: Date,
  ): Promise<CollectionOrderSummaryDto> {
    const person = cycle.customer_subscription.person;
    const subscription = cycle.customer_subscription;

    // Verificar si ya existe un pedido para este cliente en la fecha objetivo
    const existingOrder = await this.order_header.findFirst({
      where: {
        customer_id: person.person_id,
        order_date: {
          gte: targetDate,
          lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
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
        order_item: true,
      },
    });

    let orderId: number;
    let orderCreated = false;

    if (existingOrder) {
      // Verificar si ya tiene cobranza para este ciclo
      const hasCollectionForCycle =
        await this.orderCollectionEditService.hasCollectionForCycle(
          existingOrder.order_id,
          cycle.cycle_id,
        );

      if (hasCollectionForCycle) {
        this.logger.log(
          `⚠️ El pedido ${existingOrder.order_id} ya tiene cobranza para el ciclo ${cycle.cycle_id}`,
        );
        orderId = existingOrder.order_id;
        orderCreated = false;
      } else {
        // Agregar cobranza usando el servicio especializado
        this.logger.log(
          `📝 Actualizando pedido existente ${existingOrder.order_id} para cliente ${person.first_name} ${person.last_name}`,
        );

        const collectionData: CollectionItemDto = {
          cycle_id: cycle.cycle_id,
          subscription_id: cycle.subscription_id,
          customer_id: person.person_id,
          pending_balance: cycle.pending_balance,
          payment_due_date: cycle.payment_due_date,
          subscription_plan_name: subscription.subscription_plan.name,
          customer_name: `${person.first_name} ${person.last_name}`,
        };

        await this.orderCollectionEditService.addCollectionToExistingOrder(
          existingOrder.order_id,
          collectionData,
        );

        orderId = existingOrder.order_id;
        orderCreated = false; // Es una actualización, no una creación
      }
    } else {
      // Crear nuevo pedido de cobranza
      this.logger.log(
        `🆕 Creando nuevo pedido de cobranza para cliente ${person.first_name} ${person.last_name}`,
      );

      const createOrderDto: CreateOrderDto = {
        customer_id: person.person_id,
        subscription_id: subscription.subscription_id,
        sale_channel_id: 1, // Canal por defecto para cobranzas automáticas
        order_date: targetDate.toISOString(),
        scheduled_delivery_date: targetDate.toISOString(),
        delivery_time: '09:00-18:00',
        total_amount: '0.00', // Pedido de cobranza sin productos adicionales
        paid_amount: '0.00',
        order_type: OrderType.ONE_OFF, // Tipo de pedido para cobranzas
        status: OrderStatus.PENDING,
        notes: `PEDIDO DE COBRANZA AUTOMÁTICO - Suscripción: ${subscription.subscription_plan.name} - Ciclo: ${cycle.cycle_id} - Vencimiento: ${cycle.payment_due_date?.toISOString().split('T')[0]} - Monto a cobrar: $${cycle.pending_balance}`,
        items: [], // Sin productos, solo cobranza
      };

      try {
        const newOrder = await this.ordersService.create(createOrderDto);
        orderId = newOrder.order_id;
        orderCreated = true;
      } catch (error) {
        // Si falla la creación del pedido, intentar crear uno básico sin validaciones estrictas
        this.logger.warn(
          `⚠️ Fallo creación de pedido estándar, creando pedido básico de cobranza`,
        );

        const basicOrder = await this.order_header.create({
          data: {
            customer_id: person.person_id,
            subscription_id: subscription.subscription_id,
            sale_channel_id: 1,
            order_date: targetDate,
            scheduled_delivery_date: targetDate,
            delivery_time: '09:00-18:00',
            total_amount: new Prisma.Decimal(0),
            paid_amount: new Prisma.Decimal(0),
            order_type: 'ONE_OFF', // Tipo de pedido para cobranzas automáticas
            status: 'PENDING',
            notes: `COBRANZA AUTOMÁTICA - ${subscription.subscription_plan.name} - Ciclo ${cycle.cycle_id} - $${cycle.pending_balance}`,
          },
        });

        orderId = basicOrder.order_id;
        orderCreated = true;
      }
    }

    return {
      cycle_id: cycle.cycle_id,
      subscription_id: cycle.subscription_id,
      customer_id: person.person_id,
      customer_name: `${person.first_name} ${person.last_name}`,
      subscription_plan_name: subscription.subscription_plan.name,
      payment_due_date:
        cycle.payment_due_date?.toISOString().split('T')[0] || '',
      pending_balance: Number(cycle.pending_balance),
      order_created: orderCreated,
      order_id: orderId,
      notes: existingOrder
        ? 'Pedido existente actualizado con cobranza'
        : 'Nuevo pedido de cobranza creado',
    };
  }

  /**
   * Método manual para generar pedidos de cobranza para una fecha específica
   */
  async generateCollectionOrdersForDate(
    targetDate: Date,
  ): Promise<CollectionOrderSummaryDto[]> {
    this.logger.log(
      `🔧 Generación manual de pedidos de cobranza para ${targetDate.toISOString().split('T')[0]}`,
    );

    const adjustedDate = this.adjustDateForSunday(targetDate);
    const cyclesDue = await this.getCyclesDueForCollection(adjustedDate);

    const results: CollectionOrderSummaryDto[] = [];

    for (const cycle of cyclesDue) {
      try {
        const result = await this.createOrUpdateCollectionOrder(
          cycle,
          adjustedDate,
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
          payment_due_date:
            cycle.payment_due_date?.toISOString().split('T')[0] || '',
          pending_balance: Number(cycle.pending_balance),
          order_created: false,
          notes: `Error: ${error.message}`,
        });
      }
    }

    return results;
  }

  /**
   * Obtiene un resumen de los ciclos que requieren cobranza en los próximos días
   */
  async getUpcomingCollections(
    days: number = 7,
  ): Promise<CollectionOrderSummaryDto[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
      payment_due_date:
        cycle.payment_due_date?.toISOString().split('T')[0] || '',
      pending_balance: Number(cycle.pending_balance),
      order_created: false, // Se determinará al momento de la generación
      notes: 'Pendiente de generación automática',
    }));
  }
}
