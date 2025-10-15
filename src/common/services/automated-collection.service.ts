import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient, Prisma, SubscriptionStatus, OrderStatus as PrismaOrderStatus, PaymentStatus } from '@prisma/client';
import { OrderType, OrderStatus } from '../../common/constants/enums';
import { OrdersService } from '../../orders/orders.service';
import { CreateOrderDto } from '../../orders/dto/create-order.dto';
import {
  OrderCollectionEditService,
  CollectionItemDto,
} from './order-collection-edit.service';
import { FilterAutomatedCollectionsDto } from '../../orders/dto/filter-automated-collections.dto';
import { 
  AutomatedCollectionResponseDto, 
  AutomatedCollectionListResponseDto 
} from '../../orders/dto/automated-collection-response.dto';
import { GeneratePdfCollectionsDto, PdfGenerationResponseDto } from '../../orders/dto/generate-pdf-collections.dto';
import { GenerateRouteSheetDto, RouteSheetResponseDto } from '../../orders/dto/generate-route-sheet.dto';
import { DeleteAutomatedCollectionResponseDto } from '../../orders/dto/delete-automated-collection.dto';
import { PdfGeneratorService } from './pdf-generator.service';
import { RouteSheetGeneratorService } from './route-sheet-generator.service';

// Helper function to map Prisma PaymentStatus to our custom PaymentStatus
function mapPaymentStatus(prismaStatus: string): PaymentStatus {
  const statusMap: Record<string, PaymentStatus> = {
    'PENDING': PaymentStatus.PENDING,
    'PARTIAL': PaymentStatus.PARTIAL,
    'PAID': PaymentStatus.PAID,
    'OVERDUE': PaymentStatus.OVERDUE,
    'CREDITED': PaymentStatus.CREDITED,
  };
  
  return statusMap[prismaStatus] || PaymentStatus.PENDING;
}

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
    private readonly pdfGeneratorService: PdfGeneratorService,
    private readonly routeSheetGeneratorService: RouteSheetGeneratorService,
  ) {
    super();
  }

  /**
   * Aplica recargos por mora a ciclos vencidos con más de 10 días de atraso
   */
  private async applyLateFeesToOverdueCycles(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Umbral de 10 días después de la fecha de vencimiento
      const thresholdDate = new Date(today);
      thresholdDate.setDate(thresholdDate.getDate() - 10);

      // Buscar ciclos que han pasado 10 días o más desde la fecha de vencimiento
      const overdueCycles = await this.subscription_cycle.findMany({
        where: {
          payment_due_date: { 
            lte: thresholdDate  // Incluye exactamente 10 días de atraso
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
          const planPriceRaw = cycle.customer_subscription?.subscription_plan?.price as any;
          const currentTotalRaw = cycle.total_amount as any;
          const paidAmountRaw = cycle.paid_amount as any;

          const planPrice = parseFloat(planPriceRaw?.toString() || '0');
          const currentTotal = parseFloat(currentTotalRaw?.toString() || '0');
          const paidAmount = parseFloat(paidAmountRaw?.toString() || '0');

          // Si no tenemos total actual, usar el precio del plan como base
          const baseAmount = currentTotal > 0 ? currentTotal : planPrice;
          const lateFeePercentage = 0.2; // 20%
          const surcharge = Math.round(baseAmount * lateFeePercentage * 100) / 100;
          const newTotal = Math.round((baseAmount + surcharge) * 100) / 100;
          const newPending = Math.max(0, Math.round((newTotal - paidAmount) * 100) / 100);

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

    // Primero aplicar recargos por mora a ciclos vencidos
    this.logger.log('💰 Aplicando recargos por mora antes de generar órdenes...');
    await this.applyLateFeesToOverdueCycles();

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
        total_amount: cycle.pending_balance.toString(), // 🆕 CORRECCIÓN: Usar el monto pendiente de la cuota
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
            total_amount: new Prisma.Decimal(cycle.pending_balance), // 🆕 CORRECCIÓN: Usar el monto pendiente de la cuota
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
        whereClause.order_date.gte = new Date(filters.orderDateFrom);
      }
      if (filters.orderDateTo) {
        const endDate = new Date(filters.orderDateTo);
        endDate.setHours(23, 59, 59, 999);
        whereClause.order_date.lte = endDate;
      }
    }

    // Construir filtros para subscription_cycle (due dates / overdue)
    const subscriptionCycleSome: any = {};
    if (filters.dueDateFrom || filters.dueDateTo) {
      subscriptionCycleSome.payment_due_date = subscriptionCycleSome.payment_due_date || {};
      if (filters.dueDateFrom) {
        subscriptionCycleSome.payment_due_date.gte = new Date(filters.dueDateFrom);
      }
      if (filters.dueDateTo) {
        const dueEndDate = new Date(filters.dueDateTo);
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
whereClause.person = {
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
order_id: {
equals: isNaN(parseInt(filters.search)) ? undefined : parseInt(filters.search),
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
whereClause.order_id = filters.orderId;
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  subscriptionCycleSome.payment_due_date = subscriptionCycleSome.payment_due_date || {};
  subscriptionCycleSome.payment_due_date.lt = today;
  subscriptionCycleSome.pending_balance = { gt: 0 };

  // Mantener compatibilidad con estados de pago del pedido
  whereClause.AND = [
    {
      OR: [
        { payment_status: 'PENDING' },
        { payment_status: 'OVERDUE' },
      ],
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
orderBy.created_at = direction;
break;
case 'orderDate':
orderBy.order_date = direction;
break;
case 'amount':
orderBy.total_amount = direction;
break;
case 'customer':
orderBy.person = { name: direction };
break;
default:
orderBy.order_date = 'desc';
}
});
} else {
orderBy.order_date = 'desc';
}

// Ejecutar consultas
const [orders, total] = await Promise.all([
this.order_header.findMany({
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
this.order_header.count({ where: whereClause }),
]);

// Transformar datos
const data: AutomatedCollectionResponseDto[] = orders.map((order) => {
const today = new Date();
const dueDate = (order as any).customer_subscription?.subscription_cycle?.[0]?.payment_due_date;
const isOverdue = dueDate ? dueDate < today : false;
const daysOverdue = isOverdue && dueDate 
? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
: 0;

const pendingAmount = parseFloat(order.total_amount.toString()) - parseFloat(order.paid_amount.toString());

const result: AutomatedCollectionResponseDto = {
order_id: order.order_id,
order_date: order.order_date.toISOString(),
due_date: dueDate?.toISOString() || null,
total_amount: order.total_amount.toString(),
paid_amount: order.paid_amount.toString(),
pending_amount: pendingAmount.toFixed(2),
status: order.status as OrderStatus,
payment_status: order.payment_status as any,
notes: order.notes,
is_overdue: isOverdue,
days_overdue: daysOverdue,
customer: {
customer_id: order.customer_id,
name: (order as any).customer.name,
document_number: (order as any).customer.document_number,
phone: (order as any).customer.phone,
email: (order as any).customer.email,
address: (order as any).customer.address,
zone: (order as any).customer.zone ? {
zone_id: (order as any).customer.zone.zone_id,
name: (order as any).customer.zone.name,
} : null,
},
subscription_info: (order as any).customer_subscription ? {
subscription_id: (order as any).customer_subscription.subscription_id,
subscription_plan: {
subscription_plan_id: (order as any).customer_subscription.subscription_plan.subscription_plan_id,
name: (order as any).customer_subscription.subscription_plan.name,
price: (order as any).customer_subscription.subscription_plan.price.toString(),
billing_frequency: (order as any).customer_subscription.subscription_plan.billing_frequency,
},
cycle_info: (order as any).customer_subscription.subscription_cycle?.[0] ? {
cycle_id: (order as any).customer_subscription.subscription_cycle[0].cycle_id,
cycle_number: (order as any).customer_subscription.subscription_cycle[0].cycle_number,
start_date: (order as any).customer_subscription.subscription_cycle[0].start_date.toISOString(),
end_date: (order as any).customer_subscription.subscription_cycle[0].end_date.toISOString(),
due_date: (order as any).customer_subscription.subscription_cycle[0].payment_due_date?.toISOString() || '',
pending_balance: (order as any).customer_subscription.subscription_cycle[0].pending_balance.toString(),
} : null,
} : null,
created_at: (order as any).created_at.toISOString(),
updated_at: (order as any).updated_at.toISOString(),
};

return result;
});

// Calcular resumen
const summary = {
total_amount: orders.reduce((sum, order) => sum + parseFloat(order.total_amount.toString()), 0).toFixed(2),
total_paid: orders.reduce((sum, order) => sum + parseFloat(order.paid_amount.toString()), 0).toFixed(2),
total_pending: orders.reduce((sum, order) => {
const pending = parseFloat(order.total_amount.toString()) - parseFloat(order.paid_amount.toString());
return sum + pending;
}, 0).toFixed(2),
overdue_amount: data.filter(d => d.is_overdue).reduce((sum, d) => sum + parseFloat(d.pending_amount), 0).toFixed(2),
overdue_count: data.filter(d => d.is_overdue).length,
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
async getAutomatedCollectionById(orderId: number): Promise<AutomatedCollectionResponseDto> {
const order = await this.order_header.findFirst({
where: {
order_id: orderId,
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
const dueDate = (order as any).customer_subscription?.subscription_cycle?.[0]?.payment_due_date;
const isOverdue = dueDate ? dueDate < today : false;
const daysOverdue = isOverdue && dueDate 
? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
: 0;

const pendingAmount = parseFloat(order.total_amount.toString()) - parseFloat(order.paid_amount.toString());

const result: AutomatedCollectionResponseDto = {
order_id: order.order_id,
order_date: order.order_date.toISOString(),
due_date: dueDate?.toISOString() || null,
total_amount: order.total_amount.toString(),
paid_amount: order.paid_amount.toString(),
pending_amount: pendingAmount.toFixed(2),
status: order.status as OrderStatus,
payment_status: order.payment_status as any,
notes: order.notes,
is_overdue: isOverdue,
days_overdue: daysOverdue,
customer: {
customer_id: order.customer_id,
name: (order as any).customer.name,
document_number: (order as any).customer.document_number,
phone: (order as any).customer.phone,
email: (order as any).customer.email,
address: (order as any).customer.address,
zone: (order as any).customer.zone ? {
zone_id: (order as any).customer.zone.zone_id,
name: (order as any).customer.zone.name,
} : null,
},
subscription_info: (order as any).customer_subscription ? {
subscription_id: (order as any).customer_subscription.subscription_id,
subscription_plan: {
subscription_plan_id: (order as any).customer_subscription.subscription_plan.subscription_plan_id,
name: (order as any).customer_subscription.subscription_plan.name,
price: (order as any).customer_subscription.subscription_plan.price.toString(),
billing_frequency: (order as any).customer_subscription.subscription_plan.billing_frequency,
},
cycle_info: (order as any).customer_subscription.subscription_cycle?.[0] ? {
cycle_id: (order as any).customer_subscription.subscription_cycle[0].cycle_id,
cycle_number: (order as any).customer_subscription.subscription_cycle[0].cycle_number,
start_date: (order as any).customer_subscription.subscription_cycle[0].start_date.toISOString(),
end_date: (order as any).customer_subscription.subscription_cycle[0].end_date.toISOString(),
due_date: (order as any).customer_subscription.subscription_cycle[0].payment_due_date?.toISOString() || '',
pending_balance: (order as any).customer_subscription.subscription_cycle[0].pending_balance.toString(),
} : null,
} : null,
created_at: (order as any).created_at.toISOString(),
updated_at: (order as any).updated_at.toISOString(),
};

return result;
}

/**
 * Elimina lógicamente una cobranza automática
 */
async deleteAutomatedCollection(orderId: number): Promise<DeleteAutomatedCollectionResponseDto> {
const order = await this.order_header.findFirst({
where: {
order_id: orderId,
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
throw new Error('No se puede eliminar una cobranza que ya tiene pagos registrados');
}

// Eliminar lógicamente (cambiar estado)
await this.order_header.update({
where: { order_id: orderId },
data: {
status: 'CANCELLED',
notes: `${order.notes} - ELIMINADO LÓGICAMENTE`,
},
});

const pendingAmount = parseFloat(order.total_amount.toString()) - parseFloat(order.paid_amount.toString());

return {
success: true,
message: 'Cobranza automática eliminada exitosamente',
deletedOrderId: orderId,
deletedAt: new Date().toISOString(),
deletionInfo: {
was_paid: hasPaidAmount,
had_pending_amount: pendingAmount.toFixed(2),
customer_name: (order as any).customer.name,
deletion_type: 'logical',
},
};
}

/**
 * Genera un PDF con el reporte de cobranzas automáticas
 */
async generatePdfReport(filters: GeneratePdfCollectionsDto): Promise<PdfGenerationResponseDto> {
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
    return await this.pdfGeneratorService.generateCollectionReportPdf(filters, collectionsData);
  } catch (error) {
    this.logger.error('Error generando PDF:', error);
    throw new Error(`Error generando PDF: ${error.message}`);
  }
}

/**
 * Genera una hoja de ruta para cobranzas
 */
async generateRouteSheet(filters: GenerateRouteSheetDto): Promise<RouteSheetResponseDto> {
  try {
    // Usar el servicio de generación de hojas de ruta
    return await this.routeSheetGeneratorService.generateRouteSheet(filters);
  } catch (error) {
    this.logger.error('Error generando hoja de ruta:', error);
    throw new Error(`Error generando hoja de ruta: ${error.message}`);
  }
}
}
