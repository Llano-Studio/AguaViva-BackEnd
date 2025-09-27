import { CreateOrderDto } from '../../orders/dto/create-order.dto';
import {
  PrismaClient,
  PaymentStatus,
  SubscriptionStatus,
  Prisma,
} from '@prisma/client';
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SubscriptionQuotaService } from './subscription-quota.service';
import { SubscriptionCycleCalculatorService } from './subscription-cycle-calculator.service';
import { RecoveryOrderService } from './recovery-order.service';
import { OrderType, OrderStatus } from '../../common/constants/enums';
import { OrdersService } from '../../orders/orders.service';
import {
  OrderCollectionEditService,
  CollectionItemDto,
} from './order-collection-edit.service';
import {
  CustomerSearchDto,
  CustomerSearchResponseDto,
  CustomerSearchResultDto,
} from '../../orders/dto/customer-search.dto';
import {
  PendingCyclesResponseDto,
  PendingCycleDto,
  CustomerInfoDto,
} from '../../orders/dto/pending-cycles.dto';
import {
  GenerateManualCollectionDto,
  GenerateManualCollectionResponseDto,
  ExistingOrderResponseDto,
  ExistingOrderInfoDto,
} from '../../orders/dto/generate-manual-collection.dto';

@Injectable()
export class ManualCollectionService extends PrismaClient {
  private readonly logger = new Logger(ManualCollectionService.name);

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
   * Busca clientes con suscripciones activas y ciclos pendientes
   */
  async searchCustomers(
    searchDto: CustomerSearchDto,
  ): Promise<CustomerSearchResponseDto> {
    const { query, zone_id, locality_id, page = 1, limit = 10 } = searchDto;
    const skip = (page - 1) * limit;

    // Construir condiciones de búsqueda
    const whereConditions: any = {
      is_active: true,
      customer_subscription: {
        some: {
          status: SubscriptionStatus.ACTIVE,
          subscription_cycle: {
            some: {
              pending_balance: {
                gt: 0,
              },
            },
          },
        },
      },
    };

    // Agregar filtros de búsqueda
    if (query) {
      whereConditions.OR = [
        {
          name: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          phone: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          person_id: isNaN(Number(query)) ? undefined : Number(query),
        },
      ].filter(
        (condition) =>
          condition.person_id !== undefined ||
          condition.name ||
          condition.phone,
      );
    }

    if (zone_id) {
      whereConditions.zone_id = zone_id;
    }

    if (locality_id) {
      whereConditions.locality_id = locality_id;
    }

    // Obtener total de registros
    const total = await this.person.count({
      where: whereConditions,
    });

    // Obtener clientes con información agregada
    const customers = await this.person.findMany({
      where: whereConditions,
      include: {
        zone: true,
        locality: true,
        customer_subscription: {
          where: {
            status: SubscriptionStatus.ACTIVE,
          },
          include: {
            subscription_cycle: {
              where: {
                pending_balance: {
                  gt: 0,
                },
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
      skip,
      take: limit,
    });

    // Transformar datos para la respuesta
    const customerResults: CustomerSearchResultDto[] = customers.map(
      (customer) => {
        const activeSubscriptions = customer.customer_subscription.length;
        const pendingCycles = customer.customer_subscription.reduce(
          (total, subscription) =>
            total + subscription.subscription_cycle.length,
          0,
        );
        const totalPending = customer.customer_subscription.reduce(
          (total, subscription) =>
            total +
            subscription.subscription_cycle.reduce(
              (cycleTotal, cycle) => cycleTotal + Number(cycle.pending_balance),
              0,
            ),
          0,
        );

        return {
          person_id: customer.person_id,
          name: customer.name,
          phone: customer.phone || '',
          address: customer.address || '',
          zone_name: customer.zone?.name || '',
          active_subscriptions: activeSubscriptions,
          pending_cycles: pendingCycles,
          total_pending: totalPending,
        };
      },
    );

    const totalPages = Math.ceil(total / limit);

    return {
      customers: customerResults,
      total,
      page,
      totalPages,
    };
  }

  /**
   * Obtiene los ciclos pendientes de un cliente específico
   */
  async getCustomerPendingCycles(
    customerId: number,
  ): Promise<PendingCyclesResponseDto> {
    // Verificar que el cliente existe y está activo
    const customer = await this.person.findFirst({
      where: {
        person_id: customerId,
        is_active: true,
      },
      include: {
        zone: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(
        `Cliente con ID ${customerId} no encontrado o inactivo`,
      );
    }

    // Obtener ciclos pendientes
    const pendingCycles = await this.subscription_cycle.findMany({
      where: {
        customer_subscription: {
          customer_id: customerId,
          status: SubscriptionStatus.ACTIVE,
        },
        pending_balance: {
          gt: 0,
        },
      },
      include: {
        customer_subscription: {
          include: {
            subscription_plan: true,
          },
        },
      },
      orderBy: {
        payment_due_date: 'asc',
      },
    });

    // Transformar datos para la respuesta
    const pendingCyclesDto: PendingCycleDto[] = pendingCycles.map((cycle) => {
      const dueDate = cycle.payment_due_date;
      const today = new Date();
      const daysOverdue =
        dueDate && dueDate < today
          ? Math.floor(
              (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
            )
          : 0;

      let paymentStatus = 'PENDING';
      if (daysOverdue > 0) {
        paymentStatus = 'OVERDUE';
      }

      return {
        cycle_id: cycle.cycle_id,
        subscription_id: cycle.subscription_id,
        subscription_plan_name:
          cycle.customer_subscription.subscription_plan.name,
        cycle_number: cycle.cycle_number,
        payment_due_date: dueDate?.toISOString().split('T')[0] || '',
        pending_balance: Number(cycle.pending_balance),
        days_overdue: daysOverdue,
        payment_status: paymentStatus,
      };
    });

    const totalPending = pendingCycles.reduce(
      (total, cycle) => total + Number(cycle.pending_balance),
      0,
    );

    const customerInfo: CustomerInfoDto = {
      person_id: customer.person_id,
      name: customer.name,
      phone: customer.phone || '',
      address: customer.address || '',
      zone_name: customer.zone?.name || '',
    };

    return {
      customer_info: customerInfo,
      pending_cycles: pendingCyclesDto,
      total_pending: totalPending,
    };
  }

  /**
   * Verifica si existe un pedido para el cliente en la fecha especificada
   */
  async checkExistingOrder(
    customerId: number,
    date: string,
  ): Promise<ExistingOrderResponseDto> {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

    const existingOrder = await this.order_header.findFirst({
      where: {
        customer_id: customerId,
        order_date: {
          gte: targetDate,
          lt: endDate,
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

    if (!existingOrder) {
      return {
        has_existing_order: false,
      };
    }

    const orderInfo: ExistingOrderInfoDto = {
      order_id: existingOrder.order_id,
      order_date: existingOrder.order_date.toISOString(),
      total_amount: Number(existingOrder.total_amount),
      status: existingOrder.status,
      notes: existingOrder.notes || undefined,
    };

    return {
      has_existing_order: true,
      order_info: orderInfo,
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
        `📅 Fecha ajustada de domingo a sábado: ${adjustedDate.toISOString().split('T')[0]}`,
      );
    }

    return adjustedDate;
  }

  /**
   * Genera un pedido de cobranza manual para los ciclos seleccionados
   */
  async generateManualCollection(
    generateDto: GenerateManualCollectionDto,
  ): Promise<GenerateManualCollectionResponseDto> {
    const { customer_id, selected_cycles, collection_date, notes } =
      generateDto;

    // Validar fecha
    const targetDate = new Date(collection_date);
    targetDate.setHours(0, 0, 0, 0);
    const adjustedDate = this.adjustDateForSunday(targetDate);

    // Verificar que el cliente existe
    const customer = await this.person.findFirst({
      where: {
        person_id: customer_id,
        is_active: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(
        `Cliente con ID ${customer_id} no encontrado o inactivo`,
      );
    }

    // Validar que todos los ciclos existen y pertenecen al cliente
    const cycles = await this.subscription_cycle.findMany({
      where: {
        cycle_id: {
          in: selected_cycles,
        },
        customer_subscription: {
          customer_id: customer_id,
          status: SubscriptionStatus.ACTIVE,
        },
        pending_balance: {
          gt: 0,
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

    if (cycles.length !== selected_cycles.length) {
      throw new BadRequestException(
        'Algunos ciclos seleccionados no son válidos o no pertenecen al cliente',
      );
    }

    // Calcular monto total
    const totalAmount = cycles.reduce(
      (total, cycle) => total + Number(cycle.pending_balance),
      0,
    );

    // Verificar si ya existe un pedido para la fecha
    const existingOrder = await this.order_header.findFirst({
      where: {
        customer_id: customer_id,
        order_date: {
          gte: adjustedDate,
          lt: new Date(adjustedDate.getTime() + 24 * 60 * 60 * 1000),
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

    let orderId: number;
    let action: string;

    if (existingOrder) {
      // Actualizar pedido existente agregando las cobranzas
      this.logger.log(
        `📝 Actualizando pedido existente ${existingOrder.order_id} para cliente ${customer.name}`,
      );

      for (const cycle of cycles) {
        // Verificar si ya tiene cobranza para este ciclo
        const hasCollectionForCycle =
          await this.orderCollectionEditService.hasCollectionForCycle(
            existingOrder.order_id,
            cycle.cycle_id,
          );

        if (!hasCollectionForCycle) {
          const collectionData: CollectionItemDto = {
            cycle_id: cycle.cycle_id,
            subscription_id: cycle.subscription_id,
            customer_id: customer_id,
            pending_balance: Number(cycle.pending_balance),
            payment_due_date: cycle.payment_due_date,
            subscription_plan_name:
              cycle.customer_subscription.subscription_plan.name,
            customer_name: customer.name,
          };

          await this.orderCollectionEditService.addCollectionToExistingOrder(
            existingOrder.order_id,
            collectionData,
          );
        }
      }

      orderId = existingOrder.order_id;
      action = 'updated';
    } else {
      // Crear nuevo pedido de cobranza
      this.logger.log(
        `🆕 Creando nuevo pedido de cobranza manual para cliente ${customer.name}`,
      );

      const cycleDetails = cycles
        .map(
          (cycle) =>
            `Ciclo ${cycle.cycle_number} (${cycle.customer_subscription.subscription_plan.name}): $${cycle.pending_balance}`,
        )
        .join(', ');

      const orderNotes = [
        'PEDIDO DE COBRANZA MANUAL',
        `Cliente: ${customer.name}`,
        `Ciclos: ${cycleDetails}`,
        `Total: $${totalAmount}`,
        notes ? `Notas: ${notes}` : '',
      ]
        .filter(Boolean)
        .join(' - ');

      try {
        // Intentar crear pedido usando el servicio estándar
        const createOrderDto: CreateOrderDto = {
          customer_id: customer_id,
          subscription_id: cycles[0].subscription_id, // Usar la primera suscripción
          sale_channel_id: 1, // Canal por defecto
          order_date: adjustedDate.toISOString(),
          scheduled_delivery_date: adjustedDate.toISOString(),
          delivery_time: '09:00-18:00',
          total_amount: '0.00', // Pedido de cobranza sin productos adicionales
          paid_amount: '0.00',
          order_type: OrderType.ONE_OFF,
          status: OrderStatus.PENDING,
          notes: orderNotes,
          items: [], // Sin productos, solo cobranza
        };

        const newOrder = await this.ordersService.create(createOrderDto);
        orderId = newOrder.order_id;
      } catch (error) {
        // Si falla, crear pedido básico directamente
        this.logger.warn(
          `⚠️ Fallo creación de pedido estándar, creando pedido básico de cobranza`,
        );

        const basicOrder = await this.order_header.create({
          data: {
            customer_id: customer_id,
            subscription_id: cycles[0].subscription_id,
            sale_channel_id: 1,
            order_date: adjustedDate,
            scheduled_delivery_date: adjustedDate,
            delivery_time: '09:00-18:00',
            total_amount: new Prisma.Decimal(0),
            paid_amount: new Prisma.Decimal(0),
            order_type: 'ONE_OFF',
            status: 'PENDING',
            notes: orderNotes,
          },
        });

        orderId = basicOrder.order_id;
      }

      // Agregar las cobranzas al nuevo pedido
      for (const cycle of cycles) {
        const collectionData: CollectionItemDto = {
          cycle_id: cycle.cycle_id,
          subscription_id: cycle.subscription_id,
          customer_id: customer_id,
          pending_balance: Number(cycle.pending_balance),
          payment_due_date: cycle.payment_due_date,
          subscription_plan_name:
            cycle.customer_subscription.subscription_plan.name,
          customer_name: customer.name,
        };

        await this.orderCollectionEditService.addCollectionToExistingOrder(
          orderId,
          collectionData,
        );
      }

      action = 'created';
    }

    this.logger.log(
      `✅ Pedido de cobranza manual ${action === 'created' ? 'creado' : 'actualizado'} exitosamente: ${orderId}`,
    );

    return {
      success: true,
      order_id: orderId,
      action,
      total_amount: totalAmount,
      cycles_processed: cycles.length,
      message: `Pedido de cobranza ${action === 'created' ? 'generado' : 'actualizado'} exitosamente`,
    };
  }
}
