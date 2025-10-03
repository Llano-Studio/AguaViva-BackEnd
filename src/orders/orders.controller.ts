import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  Patch,
  Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { ScheduleService } from '../common/services/schedule.service';
import { OrderStatus, OrderType } from '../common/constants/enums';
import { SubscriptionQuotaService } from '../common/services/subscription-quota.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { BUSINESS_CONFIG } from '../common/config/business.config';

@ApiTags('Pedidos & Compras de una sola vez')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly scheduleService: ScheduleService,
    private readonly subscriptionQuotaService: SubscriptionQuotaService,
  ) {}

  @Post()
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({
    summary: '🆕 Crear una nueva orden (híbrida por defecto)',
    description: `Crea una nueva orden que AHORA ES HÍBRIDA POR DEFECTO con soporte completo para listas de precios individuales por producto.

## ✅ SISTEMA DE ÓRDENES HÍBRIDAS MEJORADO

**Nueva Funcionalidad Principal:**
- **🆕 LISTAS DE PRECIOS INDIVIDUALES**: Cada producto puede usar una lista diferente
- **Órdenes de Suscripción**: Solo productos del plan (total_amount = "0.00")
- **Órdenes Híbridas**: Productos del plan + productos adicionales con precios diferenciados
- **Órdenes de Contrato**: Productos con precios del contrato específico
- **Órdenes Libres**: Productos individuales con listas personalizables

## 🎯 LÓGICA DE PRECIOS POR PRODUCTO

**Prioridad de Precios (por producto individual):**
1. **Lista específica del producto** → \`item.price_list_id\` (solo para productos NO de suscripción)
2. **🆕 Control de cuotas de suscripción:**
   - **Productos del plan (dentro de cuota)** → precio $0 (ya pagado)
   - **🚨 Productos del plan (exceden cuota)** → SIEMPRE Lista General (ignora price_list_id)
3. **Cliente con contrato** → lista de precios del contrato
4. **Lista estándar** → Lista General (ID: ${BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID})
5. **Precio base** → \`product.price\` (fallback)

## 🆕 CASOS DE USO AVANZADOS

**Ejemplo 1: Orden Híbrida con Control de Cuotas**
\`\`\`json
{
  "order_type": "HYBRID",
  "subscription_id": 7,
  "items": [
    { "product_id": 1, "quantity": 4 },                    // Plan: 2 gratis + 2 con Lista General
    { "product_id": 5, "quantity": 1, "price_list_id": 3 } // NO del plan → puede usar descuento
  ]
}
\`\`\`

**Ejemplo 2: Orden con Productos Mixtos**
\`\`\`json
{
  "order_type": "ONE_OFF",
  "items": [
    { "product_id": 1, "quantity": 2, "price_list_id": 5 }, // Lista promocional
    { "product_id": 3, "quantity": 1, "price_list_id": 3 }, // Lista corporativa
    { "product_id": 4, "quantity": 1 }                      // Lista estándar
  ]
}
\`\`\`

## 💰 CÁLCULO AUTOMÁTICO DE TOTALES

**Validación de Precios:**
- El sistema calcula automáticamente según las listas especificadas
- \`total_amount\` debe coincidir exactamente con la suma calculada
- Para órdenes SUBSCRIPTION: \`total_amount\` debe ser "0.00"
- Para órdenes HYBRID: solo incluye costo de productos adicionales

**Gestión de Stock:**
- Descuento automático para productos no retornables
- Validación de stock disponible antes de confirmar
- Movimientos de inventario registrados para trazabilidad`,
  })
  @ApiBody({
    description:
      'Datos necesarios para crear un pedido regular. Los precios se calculan automáticamente según el tipo de cliente y orden.',
    type: CreateOrderDto,
    examples: {
      pedidoSuscripcion: {
        summary: '🆕 Orden de Suscripción (total_amount = 0)',
        value: {
          customer_id: 1,
          subscription_id: 7,
          sale_channel_id: 1,
          order_date: '2024-03-20T10:00:00Z',
          scheduled_delivery_date: '2024-03-21T14:00:00Z',
          delivery_time: '14:00-16:00',
          total_amount: '0.00',
          paid_amount: '0.00',
          order_type: 'SUBSCRIPTION',
          status: 'PENDING',
          notes: 'Entrega mensual de suscripción',
          items: [{ product_id: 1, quantity: 2 }],
        },
      },
      pedidoHibrido: {
        summary: '🆕 Orden Híbrida (suscripción + productos adicionales)',
        value: {
          customer_id: 1,
          subscription_id: 7,
          sale_channel_id: 1,
          order_date: '2024-03-20T10:00:00Z',
          scheduled_delivery_date: '2024-03-21T14:00:00Z',
          delivery_time: '14:00-16:00',
          total_amount: '25.00',
          paid_amount: '25.00',
          order_type: 'HYBRID',
          status: 'PENDING',
          notes: 'Productos del plan + adicionales',
          items: [
            { product_id: 1, quantity: 2 },
            { product_id: 4, quantity: 1 },
          ],
        },
      },
      pedidoContratado: {
        summary: 'Pedido con contrato (usa precios del contrato)',
        value: {
          customer_id: 1,
          contract_id: 2,
          sale_channel_id: 1,
          order_date: '2024-03-20T10:00:00Z',
          scheduled_delivery_date: '2024-03-21T14:00:00Z',
          delivery_time: '14:00-16:00',
          total_amount: '150.00',
          paid_amount: '150.00',
          order_type: 'CONTRACT_DELIVERY',
          status: 'PENDING',
          notes: 'Entregar en puerta trasera',
          items: [{ product_id: 5, quantity: 2 }],
        },
      },
      pedidoListaPersonalizada: {
        summary: '🆕 Pedido con lista de precios personalizada',
        value: {
          customer_id: 1,
          price_list_id: 3,
          sale_channel_id: 1,
          order_date: '2024-03-20T11:00:00Z',
          total_amount: '85.00',
          paid_amount: '85.00',
          order_type: 'ONE_OFF',
          status: 'PENDING',
          items: [{ product_id: 3, quantity: 1 }],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Pedido creado exitosamente.',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos o validaciones fallidas.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Cliente, producto, contrato o entidad relacionada no encontrada.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto de stock o restricción única.',
  })
  async createOrder(
    @Body(ValidationPipe) createOrderDto: CreateOrderDto,
    @GetUser() user: User,
  ): Promise<OrderResponseDto> {
    return this.ordersService.create(createOrderDto, user);
  }

  @Get()
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({
    summary: 'Obtener todos los pedidos regulares',
    description: `Obtiene una lista paginada de pedidos regulares con filtros avanzados y búsqueda inteligente.

## 🔍 BÚSQUEDA Y FILTROS AVANZADOS

**Búsqueda General:**
- Búsqueda unificada por cliente, número de pedido, notas
- Búsqueda parcial y tolerante a errores
- Resultados ordenados por relevancia

**Filtros Temporales:**
- **Fecha de Pedido**: Rango desde/hasta para análisis de ventas
- **Fecha de Entrega**: Programación y logística de entregas
- **Combinados**: Análisis de períodos específicos

**Filtros de Estado y Tipo:**
- **Estados**: PENDING, CONFIRMED, IN_DELIVERY, DELIVERED, CANCELLED
- **Tipos**: SUBSCRIPTION, HYBRID, ONE_OFF, CONTRACT
- **Combinados**: Análisis de flujo de pedidos

**Filtros Geográficos:**
- **Por Cliente**: Pedidos de cliente específico
- **Por Zona**: Optimización de rutas de entrega
- **Por Pedido**: Búsqueda directa por ID

## 📊 CASOS DE USO

**Gestión Operativa:**
- **Preparación de Entregas**: Filtrar por fecha y zona
- **Control de Estado**: Seguimiento de pedidos en proceso
- **Planificación**: Análisis de carga de trabajo

**Análisis Comercial:**
- **Ventas por Período**: Filtros temporales para reportes
- **Tipos de Pedido**: Análisis de mix de productos
- **Clientes**: Patrones de compra y frecuencia

**Logística:**
- **Rutas de Entrega**: Organización por zona y fecha
- **Capacidad**: Planificación de recursos
- **Seguimiento**: Estado de entregas en tiempo real`,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Búsqueda general por cliente, número de pedido, etc.',
  })
  @ApiQuery({
    name: 'customerName',
    required: false,
    description: 'Filtrar por nombre del cliente',
  })
  @ApiQuery({
    name: 'orderDateFrom',
    required: false,
    description: 'Filtrar por fecha de pedido desde (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'orderDateTo',
    required: false,
    description: 'Filtrar por fecha de pedido hasta (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'deliveryDateFrom',
    required: false,
    description: 'Filtrar por fecha de entrega desde (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'deliveryDateTo',
    required: false,
    description: 'Filtrar por fecha de entrega hasta (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filtrar por estado del pedido',
    enum: ['PENDING', 'CONFIRMED', 'IN_DELIVERY', 'DELIVERED', 'CANCELLED'],
  })
  @ApiQuery({
    name: 'orderType',
    required: false,
    description: 'Filtrar por tipo de pedido',
    enum: ['SUBSCRIPTION', 'HYBRID', 'ONE_OFF', 'CONTRACT'],
  })
  @ApiQuery({
    name: 'customerId',
    required: false,
    description: 'Filtrar por ID del cliente',
    type: Number,
  })
  @ApiQuery({
    name: 'orderId',
    required: false,
    description: 'Filtrar por ID del pedido',
    type: Number,
  })
  @ApiQuery({
    name: 'zoneId',
    required: false,
    description: 'Filtrar por ID de la zona',
    type: Number,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Número de página',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Elementos por página',
    type: Number,
    example: 10,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Ordenamiento (ej: order_date:desc)',
    example: 'order_date:desc',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de pedidos obtenida exitosamente.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/OrderResponseDto' },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  async findAllOrders(
    @Query(ValidationPipe) filterOrdersDto: FilterOrdersDto,
  ): Promise<{
    data: OrderResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.ordersService.findAll(filterOrdersDto);
  }

  @Get(':id')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({
    summary: 'Obtener un pedido regular por ID',
    description: `Obtiene los detalles completos de un pedido específico incluyendo toda su información comercial y operativa.

## 📋 INFORMACIÓN INCLUIDA

**Datos del Pedido:**
- Información básica: ID, fechas, estado, tipo
- Montos: total, pagado, pendiente
- Programación: fecha y horario de entrega
- Notas y observaciones especiales

**Información del Cliente:**
- Datos completos del cliente
- Dirección de entrega
- Información de contacto
- Historial de pagos relacionado

**Detalles de Productos:**
- Lista completa de ítems del pedido
- Cantidades solicitadas y entregadas
- Precios aplicados por producto
- Listas de precios utilizadas

**Información Comercial:**
- Canal de venta utilizado
- Suscripción o contrato asociado
- Método de pago y transacciones
- Estado de facturación

## 🎯 CASOS DE USO

**Atención al Cliente:**
- Consulta de estado de pedido
- Verificación de productos y cantidades
- Información de entrega y facturación

**Operaciones:**
- Preparación de pedidos para entrega
- Verificación de stock y productos
- Coordinación de rutas y horarios

**Administración:**
- Revisión de precios y descuentos
- Análisis de rentabilidad por pedido
- Auditoría de transacciones y pagos`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID del pedido',
    type: Number,
    example: 123,
  })
  @ApiResponse({
    status: 200,
    description: 'Pedido encontrado exitosamente con todos sus detalles.',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Pedido no encontrado con el ID especificado.',
  })
  async findOneOrder(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<OrderResponseDto> {
    return this.ordersService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({
    summary: 'Actualizar un pedido regular',
    description:
      'Actualiza los detalles de un pedido regular existente, incluyendo sus ítems.',
  })
  @ApiParam({ name: 'id', description: 'ID del pedido' })
  @ApiBody({ type: UpdateOrderDto })
  @ApiResponse({
    status: 200,
    description: 'Pedido actualizado exitosamente.',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos.',
  })
  @ApiResponse({
    status: 404,
    description: 'Pedido o entidad relacionada no encontrada.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto de stock o restricción única.',
  })
  async updateOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateOrderDto: UpdateOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Delete(':id')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar un pedido regular',
    description:
      'Elimina un pedido regular y sus ítems asociados. Solo permite eliminar pedidos en estado PENDING. Disponible para SUPERADMIN y Jefe Administrativo.',
  })
  @ApiParam({ name: 'id', description: 'ID del pedido' })
  @ApiResponse({
    status: 200,
    description: 'Pedido eliminado exitosamente.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        deleted: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Pedido no encontrado.',
  })
  @ApiResponse({
    status: 409,
    description:
      'No se puede eliminar un pedido que no está en estado PENDING.',
  })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene permisos suficientes.',
  })
  async removeOrder(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    return this.ordersService.remove(id);
  }

  @Get('customer/:customerId/history')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({
    summary: 'Obtener historial completo de pedidos de un cliente',
    description:
      'Retorna una lista paginada con todos los pedidos de un cliente específico, ordenados por fecha de pedido descendente.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'ID del cliente',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Número de página',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Elementos por página',
    type: Number,
    example: 10,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filtrar por estado del pedido',
    enum: ['PENDING', 'CONFIRMED', 'IN_DELIVERY', 'DELIVERED', 'CANCELLED'],
  })
  @ApiQuery({
    name: 'orderType',
    required: false,
    description: 'Filtrar por tipo de pedido',
    enum: ['SUBSCRIPTION', 'HYBRID', 'ONE_OFF', 'CONTRACT'],
  })
  @ApiQuery({
    name: 'orderDateFrom',
    required: false,
    description: 'Filtrar por fecha de pedido desde (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'orderDateTo',
    required: false,
    description: 'Filtrar por fecha de pedido hasta (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'Historial de pedidos del cliente obtenido exitosamente.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/OrderResponseDto' },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente no encontrado.',
  })
  async getCustomerOrderHistory(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('status') status?: string,
    @Query('orderType') orderType?: string,
    @Query('orderDateFrom') orderDateFrom?: string,
    @Query('orderDateTo') orderDateTo?: string,
  ): Promise<{
    data: OrderResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    // Validar que el cliente existe
    await this.ordersService.validateCustomerExists(customerId);

    const filterDto = {
      customerId,
      page: parseInt(page),
      limit: parseInt(limit),
      status: status as OrderStatus,
      orderType: orderType as OrderType,
      orderDateFrom,
      orderDateTo,
      sortBy: 'order_date:desc',
    };

    return this.ordersService.findAll(filterDto);
  }

  /**
   * Obtener horarios disponibles para entrega
   */
  @Get('available-time-slots')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({ summary: 'Obtener horarios disponibles para entrega' })
  @ApiResponse({
    status: 200,
    description: 'Lista de horarios disponibles',
    schema: {
      type: 'object',
      properties: {
        timeSlots: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              start: { type: 'string', example: '08:00' },
              end: { type: 'string', example: '10:00' },
              label: { type: 'string', example: '08:00-10:00' },
            },
          },
        },
        workingDays: {
          type: 'array',
          items: { type: 'number' },
          example: [1, 2, 3, 4, 5, 6],
        },
      },
    },
  })
  getAvailableTimeSlots() {
    return {
      timeSlots: this.scheduleService.getAvailableTimeSlots(),
      workingDays: BUSINESS_CONFIG.DELIVERY_SCHEDULE.WORKING_DAYS,
    };
  }

  /**
   * Validar horario de entrega
   */
  @Post('validate-schedule')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({ summary: 'Validar horario de entrega' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        orderDate: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-15T10:00:00.000Z',
        },
        scheduledDeliveryDate: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-16T14:00:00.000Z',
        },
        deliveryTime: { type: 'string', example: '14:00-16:00' },
      },
      required: ['orderDate', 'scheduledDeliveryDate'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de validación',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        message: { type: 'string' },
        suggestedDate: { type: 'string', format: 'date-time' },
        suggestedTimeSlot: { type: 'string' },
      },
    },
  })
  validateSchedule(
    @Body()
    body: {
      orderDate: string;
      scheduledDeliveryDate: string;
      deliveryTime?: string;
    },
    @GetUser() user: User,
  ) {
    // Permitir fechas pasadas solo para SUPERADMIN
    const allowPastDates = user.role === Role.SUPERADMIN;

    return this.scheduleService.validateOrderSchedule(
      new Date(body.orderDate),
      new Date(body.scheduledDeliveryDate),
      body.deliveryTime,
      allowPastDates,
    );
  }

  @Get('subscription/:subscriptionId/available-credits')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({ summary: 'Obtener créditos disponibles de suscripción' })
  @ApiParam({ name: 'subscriptionId', description: 'ID de la suscripción' })
  @ApiResponse({
    status: 200,
    description: 'Créditos disponibles obtenidos exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Suscripción no encontrada' })
  async getAvailableCredits(
    @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
  ): Promise<any[]> {
    const credits =
      await this.subscriptionQuotaService.getAvailableCredits(subscriptionId);
    return credits.map((credit) => ({
      product_id: credit.product_id,
      product_description: credit.product_description,
      planned_quantity: credit.planned_quantity,
      delivered_quantity: credit.delivered_quantity,
      remaining_balance: credit.remaining_balance,
    }));
  }

  @Post(':id/payments')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({
    summary: 'Procesar pago de orden híbrida',
    description:
      'Permite procesar un pago para una orden híbrida. Valida el monto contra el saldo pendiente y registra la transacción.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden híbrida',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Pago procesado exitosamente',
    schema: {
      type: 'object',
      properties: {
        payment_transaction_id: {
          type: 'number',
          description: 'ID de la transacción de pago creada',
          example: 123,
        },
        order_id: {
          type: 'number',
          description: 'ID de la orden',
          example: 1,
        },
        amount: {
          type: 'string',
          description: 'Monto del pago procesado',
          example: '150.50',
        },
        payment_method_id: {
          type: 'number',
          description: 'ID del método de pago utilizado',
          example: 1,
        },
        transaction_reference: {
          type: 'string',
          description: 'Referencia de la transacción',
          example: 'MP-123456789',
        },
        payment_date: {
          type: 'string',
          format: 'date-time',
          description: 'Fecha y hora del pago',
          example: '2024-05-21T10:30:00.000Z',
        },
        notes: {
          type: 'string',
          description: 'Notas del pago',
          example: 'Pago parcial de orden híbrida',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación o monto inválido',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden no encontrada',
  })
  async processPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() processPaymentDto: ProcessPaymentDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    return this.ordersService.processPayment(id, processPaymentDto, userId);
  }

  @Post('one-off/:id/payments')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({
    summary: 'Procesar pago de orden ONE_OFF',
    description:
      'Permite procesar un pago para una orden ONE_OFF. Valida el monto contra el saldo pendiente y registra la transacción.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden ONE_OFF',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Pago procesado exitosamente',
    schema: {
      type: 'object',
      properties: {
        payment_transaction_id: {
          type: 'number',
          description: 'ID de la transacción de pago creada',
          example: 123,
        },
        order_id: {
          type: 'number',
          description: 'ID de la orden',
          example: 1,
        },
        amount: {
          type: 'string',
          description: 'Monto del pago procesado',
          example: '150.50',
        },
        payment_method_id: {
          type: 'number',
          description: 'ID del método de pago utilizado',
          example: 1,
        },
        transaction_reference: {
          type: 'string',
          description: 'Referencia de la transacción',
          example: 'MP-123456789',
        },
        payment_date: {
          type: 'string',
          format: 'date-time',
          description: 'Fecha y hora del pago',
          example: '2024-05-21T10:30:00.000Z',
        },
        notes: {
          type: 'string',
          description: 'Notas del pago',
          example: 'Pago de orden ONE_OFF',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación o monto inválido',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden no encontrada',
  })
  async processOneOffPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() processPaymentDto: ProcessPaymentDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    return this.ordersService.processOneOffPayment(
      id,
      processPaymentDto,
      userId,
    );
  }

  @Post('generate-collection/:cycleId')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({
    summary: 'Generar orden de cobranza automática por cycle_id',
    description:
      'Genera automáticamente una orden de cobranza para un ciclo específico de suscripción si no existe ya una para ese ciclo.',
  })
  @ApiParam({
    name: 'cycleId',
    description: 'ID del ciclo de suscripción',
    example: 1,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        collection_date: {
          type: 'string',
          format: 'date',
          description: 'Fecha para la orden de cobranza (YYYY-MM-DD)',
          example: '2024-05-21',
        },
        notes: {
          type: 'string',
          description: 'Notas adicionales para la orden de cobranza',
          example: 'Cobranza generada automáticamente',
        },
      },
      required: ['collection_date'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Orden de cobranza generada exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Orden de cobranza generada exitosamente',
        },
        order_id: { type: 'number', example: 123 },
        cycle_id: { type: 'number', example: 1 },
        collection_amount: { type: 'string', example: '15000.00' },
        collection_date: { type: 'string', example: '2024-05-21' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación o ciclo ya tiene orden de cobranza',
  })
  @ApiResponse({
    status: 404,
    description: 'Ciclo de suscripción no encontrado',
  })
  async generateCollectionOrder(
    @Param('cycleId', ParseIntPipe) cycleId: number,
    @Body() body: { collection_date: string; notes?: string },
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    return this.ordersService.generateCollectionOrder(
      cycleId,
      body.collection_date,
      body.notes,
      userId,
    );
  }
}
