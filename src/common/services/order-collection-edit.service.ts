import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient, OrderStatus } from '@prisma/client';
import { OrdersService } from '../../orders/orders.service';

export interface CollectionItemDto {
  cycle_id: number;
  subscription_id: number;
  customer_id: number;
  pending_balance: number;
  payment_due_date: Date;
  subscription_plan_name: string;
  customer_name: string;
}

export interface AddCollectionResult {
  order_id: number;
  collection_added: boolean;
  collection_amount: number;
  message: string;
}

@Injectable()
export class OrderCollectionEditService
  extends PrismaClient
  implements OnModuleInit
{
  private readonly logger = new Logger(OrderCollectionEditService.name);

  constructor(private readonly ordersService: OrdersService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Verifica si un cliente tiene un pedido existente para una fecha específica
   */
  async findExistingOrderForDate(
    customerId: number,
    targetDate: Date,
  ): Promise<any | null> {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return await this.order_header.findFirst({
      where: {
        customer_id: customerId,
        order_date: {
          gte: startOfDay,
          lte: endOfDay,
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
        order_item: {
          include: {
            product: true,
          },
        },
        customer: {
          select: {
            person_id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Agrega información de cobranza a un pedido existente
   */
  async addCollectionToExistingOrder(
    orderId: number,
    collectionData: CollectionItemDto,
  ): Promise<AddCollectionResult> {
    try {
      // Verificar que el pedido existe y está en estado editable
      const existingOrder = await this.order_header.findUnique({
        where: { order_id: orderId },
        include: {
          order_item: true,
          customer: true,
        },
      });

      if (!existingOrder) {
        throw new NotFoundException(`Pedido con ID ${orderId} no encontrado`);
      }

      if (
        ![
          'PENDING' as OrderStatus,
          'CONFIRMED' as OrderStatus,
          'IN_PREPARATION' as OrderStatus,
        ].includes(existingOrder.status)
      ) {
        throw new BadRequestException(
          `No se puede agregar cobranza al pedido ${orderId}. Estado actual: ${existingOrder.status}`,
        );
      }

      // Verificar que el pedido pertenece al cliente correcto
      if (existingOrder.customer_id !== collectionData.customer_id) {
        throw new BadRequestException(
          `El pedido ${orderId} no pertenece al cliente ${collectionData.customer_id}`,
        );
      }

      // Crear nota de cobranza
      const collectionNote = `COBRANZA AGREGADA: Suscripción ${collectionData.subscription_plan_name} - Ciclo ${collectionData.cycle_id} - Monto pendiente: $${collectionData.pending_balance} - Vencimiento: ${collectionData.payment_due_date.toISOString().split('T')[0]}`;

      const updatedNotes = existingOrder.notes
        ? `${existingOrder.notes} | ${collectionNote}`
        : collectionNote;

      // Actualizar las notas del pedido
      await this.order_header.update({
        where: { order_id: orderId },
        data: {
          notes: updatedNotes,
        },
      });

      this.logger.log(
        `✅ Cobranza agregada al pedido ${orderId} para cliente ${collectionData.customer_name}. Monto: $${collectionData.pending_balance}`,
      );

      return {
        order_id: orderId,
        collection_added: true,
        collection_amount: collectionData.pending_balance,
        message: `Cobranza de $${collectionData.pending_balance} agregada al pedido ${orderId}`,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error agregando cobranza al pedido ${orderId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Busca todos los pedidos existentes para una fecha específica que puedan recibir cobranzas
   */
  async findEditableOrdersForDate(targetDate: Date): Promise<any[]> {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return await this.order_header.findMany({
      where: {
        order_date: {
          gte: startOfDay,
          lte: endOfDay,
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
        customer: {
          select: {
            person_id: true,
            name: true,
          },
        },
        order_item: {
          include: {
            product: {
              select: {
                product_id: true,
                description: true,
              },
            },
          },
        },
      },
      orderBy: {
        customer_id: 'asc',
      },
    });
  }

  /**
   * Obtiene un resumen de pedidos que pueden ser editados para agregar cobranzas
   */
  async getEditableOrdersSummary(targetDate: Date): Promise<{
    total_orders: number;
    orders_by_customer: {
      customer_id: number;
      customer_name: string;
      order_id: number;
      order_total: string;
    }[];
  }> {
    const editableOrders = await this.findEditableOrdersForDate(targetDate);

    return {
      total_orders: editableOrders.length,
      orders_by_customer: editableOrders.map((order) => ({
        customer_id: order.customer_id,
        customer_name: `${order.customer.first_name} ${order.customer.last_name}`,
        order_id: order.order_id,
        order_total: order.total_amount.toString(),
      })),
    };
  }

  /**
   * Verifica si un pedido ya tiene información de cobranza para un ciclo específico
   */
  async hasCollectionForCycle(
    orderId: number,
    cycleId: number,
  ): Promise<boolean> {
    const order = await this.order_header.findUnique({
      where: { order_id: orderId },
      select: { notes: true },
    });

    if (!order || !order.notes) {
      return false;
    }

    // Buscar si ya existe una referencia al ciclo en las notas
    return order.notes.includes(`Ciclo ${cycleId}`);
  }
}
