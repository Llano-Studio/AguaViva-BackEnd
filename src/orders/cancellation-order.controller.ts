import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';
import {
  CancellationOrderService,
  CancellationOrderResponseDto,
} from './cancellation-order.service';
import { CancellationOrderWithProductsDto } from './dto/cancellation-order-with-products.dto';
import { CreateCancellationOrderDto } from './dto/create-cancellation-order.dto';
import { UpdateCancellationOrderDto } from './dto/update-cancellation-order.dto';
import { CancellationOrderReassignmentService } from '../common/services/cancellation-order-reassignment.service';
import { CancellationOrderStatus } from '@prisma/client';

@ApiTags('Ordenes de Cancelacion')
@ApiBearerAuth()
@Controller('cancellation-orders')
export class CancellationOrderController {
  constructor(
    private readonly cancellationOrderService: CancellationOrderService,
    private readonly cancellationOrderReassignmentService: CancellationOrderReassignmentService,
  ) {}

  @Post()
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Crear orden de cancelación de suscripción',
    description: `Crea una nueva orden de cancelación para gestionar la recolección de productos cuando una suscripción es cancelada.

## 🔄 GESTIÓN DE CANCELACIONES

**Proceso de Cancelación:**
- Se genera automáticamente cuando una suscripción es cancelada
- Programa la recolección de productos en comodato
- Gestiona la devolución de stock al inventario
- Coordina con hojas de ruta para logística

## 📦 PRODUCTOS A RECOLECTAR

**Tipos de Recolección:**
- **Bidones Retornables**: Productos en comodato del cliente
- **Dispensadores**: Equipos prestados durante la suscripción
- **Accesorios**: Elementos adicionales asociados

## 📅 PROGRAMACIÓN AUTOMÁTICA

- Fecha de recolección programable
- Asignación automática a hojas de ruta
- Seguimiento del estado de recolección
- Reasignación automática en caso de fallas`,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        subscription_id: {
          type: 'number',
          description: 'ID de la suscripción cancelada',
        },
        scheduled_collection_date: {
          type: 'string',
          format: 'date',
          description: 'Fecha programada para recolección',
        },
        notes: { type: 'string', description: 'Notas adicionales (opcional)' },
      },
      required: ['subscription_id', 'scheduled_collection_date'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Orden de cancelación creada exitosamente',
    schema: {
      type: 'object',
      properties: {
        cancellation_order_id: { type: 'number' },
        subscription_id: { type: 'number' },
        scheduled_collection_date: { type: 'string', format: 'date' },
        status: {
          type: 'string',
          enum: Object.values(CancellationOrderStatus),
        },
        notes: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
        rescheduled_count: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o suscripción no cancelada',
  })
  @ApiResponse({ status: 404, description: 'Suscripción no encontrada' })
  async create(
    @Body(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        whitelist: true,
        skipMissingProperties: true,
      }),
    )
    createDto: CreateCancellationOrderDto,
  ): Promise<CancellationOrderResponseDto> {
    return this.cancellationOrderService.createCancellationOrder(createDto);
  }

  @Get()
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({
    summary: 'Obtener órdenes de cancelación',
    description:
      'Obtiene todas las órdenes de cancelación con filtros opcionales',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: CancellationOrderStatus,
    description: 'Filtrar por estado',
  })
  @ApiQuery({
    name: 'subscription_id',
    required: false,
    type: Number,
    description: 'Filtrar por ID de suscripción',
  })
  @ApiQuery({
    name: 'scheduled_date_from',
    required: false,
    type: String,
    description: 'Fecha desde (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'scheduled_date_to',
    required: false,
    type: String,
    description: 'Fecha hasta (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de órdenes de cancelación',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          cancellation_order_id: { type: 'number' },
          subscription_id: { type: 'number' },
          scheduled_collection_date: { type: 'string', format: 'date' },
          actual_collection_date: { type: 'string', format: 'date' },
          status: {
            type: 'string',
            enum: Object.values(CancellationOrderStatus),
          },
          route_sheet_id: { type: 'number' },
          notes: { type: 'string' },
          rescheduled_count: { type: 'number' },
          subscription: {
            type: 'object',
            properties: {
              customer_id: { type: 'number' },
              subscription_plan_id: { type: 'number' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async findAll(
    @Query('status') status?: CancellationOrderStatus,
    @Query('subscription_id', new ParseIntPipe({ optional: true }))
    subscriptionId?: number,
    @Query('scheduled_date_from') scheduledDateFrom?: string,
    @Query('scheduled_date_to') scheduledDateTo?: string,
  ): Promise<CancellationOrderResponseDto[]> {
    const filters: any = {};

    if (status) filters.status = status;
    if (subscriptionId) filters.subscription_id = subscriptionId;
    if (scheduledDateFrom)
      filters.scheduled_date_from = new Date(scheduledDateFrom);
    if (scheduledDateTo) filters.scheduled_date_to = new Date(scheduledDateTo);

    return this.cancellationOrderService.findAll(filters);
  }

  @Get('with-products')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({
    summary: 'Obtener órdenes de cancelación con información de productos',
    description:
      'Obtiene todas las órdenes de cancelación con información detallada de productos y clientes',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: CancellationOrderStatus,
    description: 'Filtrar por estado',
  })
  @ApiQuery({
    name: 'subscription_id',
    required: false,
    type: Number,
    description: 'Filtrar por ID de suscripción',
  })
  @ApiQuery({
    name: 'scheduled_date_from',
    required: false,
    type: String,
    description: 'Fecha desde (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'scheduled_date_to',
    required: false,
    type: String,
    description: 'Fecha hasta (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de órdenes de cancelación con productos',
    type: [CancellationOrderWithProductsDto],
  })
  async findAllWithProducts(
    @Query('status') status?: CancellationOrderStatus,
    @Query('subscription_id', new ParseIntPipe({ optional: true }))
    subscriptionId?: number,
    @Query('scheduled_date_from') scheduledDateFrom?: string,
    @Query('scheduled_date_to') scheduledDateTo?: string,
  ): Promise<CancellationOrderWithProductsDto[]> {
    const filters: any = {};

    if (status) filters.status = status;
    if (subscriptionId) filters.subscription_id = subscriptionId;
    if (scheduledDateFrom)
      filters.scheduled_date_from = new Date(scheduledDateFrom);
    if (scheduledDateTo) filters.scheduled_date_to = new Date(scheduledDateTo);

    return this.cancellationOrderService.findAllWithProducts(filters);
  }

  @Get('pending')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({
    summary: 'Obtener órdenes pendientes',
    description:
      'Obtiene todas las órdenes de cancelación pendientes de asignación',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de órdenes pendientes',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          cancellation_order_id: { type: 'number' },
          subscription_id: { type: 'number' },
          scheduled_collection_date: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['PENDING'] },
          notes: { type: 'string' },
          rescheduled_count: { type: 'number' },
        },
      },
    },
  })
  async getPendingOrders(): Promise<CancellationOrderResponseDto[]> {
    return this.cancellationOrderService.getPendingOrders();
  }

  @Get('by-date/:date')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({
    summary: 'Obtener órdenes por fecha',
    description:
      'Obtiene todas las órdenes de cancelación programadas para una fecha específica',
  })
  @ApiParam({ name: 'date', description: 'Fecha en formato YYYY-MM-DD' })
  @ApiResponse({
    status: 200,
    description: 'Lista de órdenes para la fecha especificada',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          cancellation_order_id: { type: 'number' },
          subscription_id: { type: 'number' },
          scheduled_collection_date: { type: 'string', format: 'date' },
          status: {
            type: 'string',
            enum: Object.values(CancellationOrderStatus),
          },
          route_sheet_id: { type: 'number' },
          notes: { type: 'string' },
        },
      },
    },
  })
  async getOrdersForDate(
    @Param('date') date: string,
  ): Promise<CancellationOrderResponseDto[]> {
    return this.cancellationOrderService.getOrdersForDate(new Date(date));
  }

  @Get(':id')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({
    summary: 'Obtener orden de cancelación por ID',
    description: 'Obtiene una orden de cancelación específica por su ID',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de cancelación' })
  @ApiResponse({
    status: 200,
    description: 'Orden de cancelación encontrada',
    schema: {
      type: 'object',
      properties: {
        cancellation_order_id: { type: 'number' },
        subscription_id: { type: 'number' },
        scheduled_collection_date: { type: 'string', format: 'date' },
        actual_collection_date: { type: 'string', format: 'date' },
        status: {
          type: 'string',
          enum: Object.values(CancellationOrderStatus),
        },
        route_sheet_id: { type: 'number' },
        notes: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
        rescheduled_count: { type: 'number' },
        subscription: {
          type: 'object',
          properties: {
            customer_id: { type: 'number' },
            subscription_plan_id: { type: 'number' },
            status: { type: 'string' },
          },
        },
        route_sheet: {
          type: 'object',
          properties: {
            route_sheet_id: { type: 'number' },
            delivery_date: { type: 'string', format: 'date' },
            driver_id: { type: 'number' },
            vehicle_id: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de cancelación no encontrada',
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CancellationOrderResponseDto> {
    return this.cancellationOrderService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Actualizar orden de cancelación',
    description: `Actualiza una orden de cancelación existente.

🆕 **FUNCIONALIDAD AUTOMÁTICA DE COMODATOS:**
Cuando el estado de la orden cambia a 'COMPLETED' (equivalente a DELIVERED), se eliminan automáticamente todos los comodatos activos asociados a la suscripción:

• **Eliminación Automática**: Los comodatos se marcan como 'RETURNED'
• **Fecha de Devolución**: Se establece automáticamente la fecha actual
• **Desactivación**: Los comodatos se marcan como inactivos (is_active = false)
• **Trazabilidad**: Se agrega una nota explicativa del proceso automático
• **Logging**: Se registra la acción en los logs del sistema

⚠️ **IMPORTANTE**: Esta acción es irreversible y se ejecuta automáticamente al cambiar el estado a COMPLETED.`,
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de cancelación' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        scheduled_collection_date: {
          type: 'string',
          format: 'date',
          description: 'Nueva fecha programada',
        },
        actual_collection_date: {
          type: 'string',
          format: 'date',
          description: 'Fecha real de recolección',
        },
        status: {
          type: 'string',
          enum: Object.values(CancellationOrderStatus),
          description: 'Nuevo estado',
        },
        route_sheet_id: {
          type: 'number',
          description: 'ID de la hoja de ruta asignada',
        },
        notes: { type: 'string', description: 'Notas actualizadas' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Orden de cancelación actualizada exitosamente',
    schema: {
      type: 'object',
      properties: {
        cancellation_order_id: { type: 'number' },
        subscription_id: { type: 'number' },
        scheduled_collection_date: { type: 'string', format: 'date' },
        actual_collection_date: { type: 'string', format: 'date' },
        status: {
          type: 'string',
          enum: Object.values(CancellationOrderStatus),
        },
        route_sheet_id: { type: 'number' },
        notes: { type: 'string' },
        rescheduled_count: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de cancelación no encontrada',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateDto: UpdateCancellationOrderDto,
  ): Promise<CancellationOrderResponseDto> {
    return this.cancellationOrderService.update(id, updateDto);
  }

  @Patch(':id/assign-route/:routeSheetId')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Asignar orden a hoja de ruta',
    description:
      'Asigna una orden de cancelación a una hoja de ruta específica',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de cancelación' })
  @ApiParam({ name: 'routeSheetId', description: 'ID de la hoja de ruta' })
  @ApiResponse({
    status: 200,
    description: 'Orden asignada exitosamente a la hoja de ruta',
    schema: {
      type: 'object',
      properties: {
        cancellation_order_id: { type: 'number' },
        subscription_id: { type: 'number' },
        route_sheet_id: { type: 'number' },
        status: { type: 'string', enum: ['SCHEDULED'] },
        scheduled_collection_date: { type: 'string', format: 'date' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de cancelación o hoja de ruta no encontrada',
  })
  async assignToRouteSheet(
    @Param('id', ParseIntPipe) id: number,
    @Param('routeSheetId', ParseIntPipe) routeSheetId: number,
  ): Promise<CancellationOrderResponseDto> {
    return this.cancellationOrderService.assignToRouteSheet(id, routeSheetId);
  }

  @Post(':id/complete')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({
    summary: 'Completar orden de cancelación',
    description:
      'Marca una orden de cancelación como completada y procesa la devolución de stock',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de cancelación' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        actual_collection_date: {
          type: 'string',
          format: 'date-time',
          description: 'Fecha y hora real de recolección',
        },
      },
      required: ['actual_collection_date'],
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Orden completada exitosamente con devolución de stock procesada',
    schema: {
      type: 'object',
      properties: {
        order: {
          type: 'object',
          properties: {
            cancellation_order_id: { type: 'number' },
            subscription_id: { type: 'number' },
            actual_collection_date: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['COMPLETED'] },
          },
        },
        stockMovements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              movement_id: { type: 'number' },
              product_id: { type: 'number' },
              quantity: { type: 'number' },
              movement_type: { type: 'string' },
              remarks: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Orden ya completada o datos inválidos',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de cancelación no encontrada',
  })
  @HttpCode(HttpStatus.OK)
  async completeCancellationOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body('actual_collection_date') actualCollectionDate: string,
  ): Promise<{ order: CancellationOrderResponseDto; stockMovements: any[] }> {
    return this.cancellationOrderService.completeCancellationOrder(
      id,
      new Date(actualCollectionDate),
    );
  }

  @Post(':id/mark-failed')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({ summary: 'Marcar orden de cancelación como fallida' })
  @ApiResponse({
    status: 200,
    description: 'Orden de cancelación marcada como fallida',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de cancelación no encontrada',
  })
  async markAsFailed(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: string },
  ) {
    return this.cancellationOrderReassignmentService.markCancellationOrderAsFailed(
      id,
      body.reason,
    );
  }

  @Post('reassignment/force')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Forzar reasignación de órdenes de cancelación fallidas',
  })
  @ApiResponse({
    status: 200,
    description: 'Reasignación ejecutada exitosamente',
  })
  async forceReassignment() {
    return this.cancellationOrderReassignmentService.forceReassignmentCheck();
  }

  @Get('reassignment/stats')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener estadísticas de reasignación de órdenes de cancelación',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
  })
  async getReassignmentStats() {
    return this.cancellationOrderReassignmentService.getFailedCancellationOrdersStats();
  }
}
