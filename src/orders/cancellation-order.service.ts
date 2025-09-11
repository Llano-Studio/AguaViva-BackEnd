import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaClient, CancellationOrderStatus, Prisma } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { BUSINESS_CONFIG } from '../common/config/business.config';

export interface CreateCancellationOrderDto {
  subscription_id: number;
  scheduled_collection_date: Date;
  notes?: string;
}

export interface UpdateCancellationOrderDto {
  scheduled_collection_date?: Date;
  actual_collection_date?: Date;
  status?: CancellationOrderStatus;
  route_sheet_id?: number;
  notes?: string;
}

export interface CancellationOrderResponseDto {
  cancellation_order_id: number;
  subscription_id: number;
  scheduled_collection_date: Date;
  actual_collection_date?: Date;
  status: CancellationOrderStatus;
  route_sheet_id?: number;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  rescheduled_count: number;
  subscription?: {
    customer_id: number;
    subscription_plan_id: number;
    status: string;
  };
  route_sheet?: {
    route_sheet_id: number;
    delivery_date: Date;
    driver_id: number;
    vehicle_id: number;
  };
}

@Injectable()
export class CancellationOrderService extends PrismaClient {
  private readonly logger = new Logger(CancellationOrderService.name);

  constructor(private readonly inventoryService: InventoryService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('CancellationOrderService initialized');
  }

  /**
   * Crear una orden de cancelación cuando se cancela una suscripción
   */
  async createCancellationOrder(
    dto: CreateCancellationOrderDto,
    tx?: Prisma.TransactionClient,
  ): Promise<CancellationOrderResponseDto> {
    const prisma = tx || this;

    this.logger.log(
      `Creating cancellation order for subscription ${dto.subscription_id}`,
    );

    // Verificar que la suscripción existe y está cancelada
    const subscription = await prisma.customer_subscription.findUnique({
      where: { subscription_id: dto.subscription_id },
      include: {
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
    });

    if (!subscription) {
      throw new NotFoundException(
        `Suscripción con ID ${dto.subscription_id} no encontrada`,
      );
    }

    if (subscription.status !== 'CANCELLED') {
      throw new BadRequestException(
        'Solo se pueden crear órdenes de cancelación para suscripciones canceladas',
      );
    }

    // Verificar si ya existe una orden de cancelación para esta suscripción
    const existingOrder = await prisma.cancellation_order.findFirst({
      where: {
        subscription_id: dto.subscription_id,
        status: {
          in: [
            CancellationOrderStatus.PENDING,
            CancellationOrderStatus.SCHEDULED,
            CancellationOrderStatus.IN_PROGRESS,
          ],
        },
      },
    });

    if (existingOrder) {
      throw new BadRequestException(
        'Ya existe una orden de cancelación activa para esta suscripción',
      );
    }

    const cancellationOrder = await prisma.cancellation_order.create({
      data: {
        subscription_id: dto.subscription_id,
        scheduled_collection_date: dto.scheduled_collection_date,
        status: CancellationOrderStatus.PENDING,
        notes: dto.notes,
        rescheduled_count: 0,
      },
      include: {
        customer_subscription: {
          select: {
            customer_id: true,
            subscription_plan_id: true,
            status: true,
          },
        },
      },
    });

    this.logger.log(
      `Created cancellation order ${cancellationOrder.cancellation_order_id} for subscription ${dto.subscription_id}`,
    );

    return this.mapToResponseDto(cancellationOrder);
  }

  /**
   * Obtener todas las órdenes de cancelación con filtros
   */
  async findAll(filters?: {
    status?: CancellationOrderStatus;
    subscription_id?: number;
    scheduled_date_from?: Date;
    scheduled_date_to?: Date;
  }): Promise<CancellationOrderResponseDto[]> {
    const where: Prisma.cancellation_orderWhereInput = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.subscription_id) {
      where.subscription_id = filters.subscription_id;
    }

    if (filters?.scheduled_date_from || filters?.scheduled_date_to) {
      where.scheduled_collection_date = {};
      if (filters.scheduled_date_from) {
        where.scheduled_collection_date.gte = filters.scheduled_date_from;
      }
      if (filters.scheduled_date_to) {
        where.scheduled_collection_date.lte = filters.scheduled_date_to;
      }
    }

    const orders = await this.cancellation_order.findMany({
      where,
      include: {
        customer_subscription: {
          select: {
            customer_id: true,
            subscription_plan_id: true,
            status: true,
          },
        },
        route_sheet: {
          select: {
            route_sheet_id: true,
            delivery_date: true,
            driver_id: true,
            vehicle_id: true,
          },
        },
      },
      orderBy: {
        scheduled_collection_date: 'asc',
      },
    });

    return orders.map((order) => this.mapToResponseDto(order));
  }

  /**
   * Obtener una orden de cancelación por ID
   */
  async findOne(id: number): Promise<CancellationOrderResponseDto> {
    const order = await this.cancellation_order.findUnique({
      where: { cancellation_order_id: id },
      include: {
        customer_subscription: {
          select: {
            customer_id: true,
            subscription_plan_id: true,
            status: true,
          },
        },
        route_sheet: {
          select: {
            route_sheet_id: true,
            delivery_date: true,
            driver_id: true,
            vehicle_id: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Orden de cancelación con ID ${id} no encontrada`,
      );
    }

    return this.mapToResponseDto(order);
  }

  /**
   * Actualizar una orden de cancelación
   */
  async update(
    id: number,
    dto: UpdateCancellationOrderDto,
    tx?: Prisma.TransactionClient,
  ): Promise<CancellationOrderResponseDto> {
    const prisma = tx || this;

    const existingOrder = await this.findOne(id);

    // Si se está cambiando la fecha programada, incrementar el contador de reprogramaciones
    const updateData: any = { ...dto };
    if (
      dto.scheduled_collection_date &&
      dto.scheduled_collection_date.getTime() !==
        existingOrder.scheduled_collection_date.getTime()
    ) {
      updateData.rescheduled_count = existingOrder.rescheduled_count + 1;
      updateData.status = CancellationOrderStatus.RESCHEDULED;
    }

    const updatedOrder = await prisma.cancellation_order.update({
      where: { cancellation_order_id: id },
      data: updateData,
      include: {
        customer_subscription: {
          select: {
            customer_id: true,
            subscription_plan_id: true,
            status: true,
          },
        },
        route_sheet: {
          select: {
            route_sheet_id: true,
            delivery_date: true,
            driver_id: true,
            vehicle_id: true,
          },
        },
      },
    });

    this.logger.log(`Updated cancellation order ${id}`);
    return this.mapToResponseDto(updatedOrder);
  }

  /**
   * Asignar una orden de cancelación a una hoja de ruta
   */
  async assignToRouteSheet(
    id: number,
    routeSheetId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<CancellationOrderResponseDto> {
    const prisma = tx || this;

    // Verificar que la hoja de ruta existe
    const routeSheet = await prisma.route_sheet.findUnique({
      where: { route_sheet_id: routeSheetId },
    });

    if (!routeSheet) {
      throw new NotFoundException(
        `Hoja de ruta con ID ${routeSheetId} no encontrada`,
      );
    }

    return this.update(
      id,
      {
        route_sheet_id: routeSheetId,
        status: CancellationOrderStatus.SCHEDULED,
      },
      tx,
    );
  }

  /**
   * Completar una orden de cancelación y procesar la devolución de stock
   */
  async completeCancellationOrder(
    id: number,
    actualCollectionDate: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<{ order: CancellationOrderResponseDto; stockMovements: any[] }> {
    const prisma = tx || this;

    const order = await this.findOne(id);

    if (order.status === CancellationOrderStatus.COMPLETED) {
      throw new BadRequestException(
        'La orden de cancelación ya está completada',
      );
    }

    // Obtener información de la suscripción y productos
    const subscription = await prisma.customer_subscription.findUnique({
      where: { subscription_id: order.subscription_id },
      include: {
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
    });

    if (!subscription) {
      throw new NotFoundException(
        `Suscripción con ID ${order.subscription_id} no encontrada`,
      );
    }

    const stockMovements = [];

    // Procesar devolución de stock para productos retornables
    const returnMovementTypeId =
      await this.inventoryService.getMovementTypeIdByCode(
        BUSINESS_CONFIG.MOVEMENT_TYPES
          .INGRESO_DEVOLUCION_CANCELACION_SUSCRIPCION,
        prisma,
      );

    for (const planProduct of subscription.subscription_plan
      .subscription_plan_product) {
      const product = planProduct.product;

      // Solo procesar productos retornables
      if (product.is_returnable) {
        const stockMovement = await this.inventoryService.createStockMovement(
          {
            movement_type_id: returnMovementTypeId,
            product_id: product.product_id,
            quantity: planProduct.product_quantity,
            source_warehouse_id: null,
            destination_warehouse_id:
              BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
            movement_date: actualCollectionDate,
            remarks: `Devolución por cancelación de suscripción ${order.subscription_id} - Producto: ${product.description} - Orden de cancelación: ${id}`,
          },
          prisma,
        );

        stockMovements.push(stockMovement);

        this.logger.log(
          `Stock devuelto: ${planProduct.product_quantity} unidades de ${product.description} (retornable)`,
        );
      } else {
        this.logger.log(
          `No se devuelve stock para ${product.description} - producto NO retornable`,
        );
      }
    }

    // Actualizar la orden como completada
    const updatedOrder = await this.update(
      id,
      {
        actual_collection_date: actualCollectionDate,
        status: CancellationOrderStatus.COMPLETED,
      },
      prisma,
    );

    // Marcar la suscripción como recolección completada
    await prisma.customer_subscription.update({
      where: { subscription_id: order.subscription_id },
      data: {
        collection_completed: true,
        collection_date: actualCollectionDate,
      },
    });

    this.logger.log(
      `Completed cancellation order ${id} with ${stockMovements.length} stock movements`,
    );

    return {
      order: updatedOrder,
      stockMovements,
    };
  }

  /**
   * Obtener órdenes de cancelación pendientes de asignación
   */
  async getPendingOrders(): Promise<CancellationOrderResponseDto[]> {
    return this.findAll({
      status: CancellationOrderStatus.PENDING,
    });
  }

  /**
   * Obtener órdenes de cancelación programadas para una fecha específica
   */
  async getOrdersForDate(date: Date): Promise<CancellationOrderResponseDto[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.findAll({
      scheduled_date_from: startOfDay,
      scheduled_date_to: endOfDay,
    });
  }

  /**
   * Mapear entidad a DTO de respuesta
   */
  private mapToResponseDto(order: any): CancellationOrderResponseDto {
    return {
      cancellation_order_id: order.cancellation_order_id,
      subscription_id: order.subscription_id,
      scheduled_collection_date: order.scheduled_collection_date,
      actual_collection_date: order.actual_collection_date,
      status: order.status,
      route_sheet_id: order.route_sheet_id,
      notes: order.notes,
      created_at: order.created_at,
      updated_at: order.updated_at,
      rescheduled_count: order.rescheduled_count,
      subscription: order.customer_subscription
        ? {
            customer_id: order.customer_subscription.customer_id,
            subscription_plan_id:
              order.customer_subscription.subscription_plan_id,
            status: order.customer_subscription.status,
          }
        : undefined,
      route_sheet: order.route_sheet
        ? {
            route_sheet_id: order.route_sheet.route_sheet_id,
            delivery_date: order.route_sheet.delivery_date,
            driver_id: order.route_sheet.driver_id,
            vehicle_id: order.route_sheet.vehicle_id,
          }
        : undefined,
    };
  }
}
