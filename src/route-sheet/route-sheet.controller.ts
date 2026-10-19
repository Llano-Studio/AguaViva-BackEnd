import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  ValidationPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  CreateRouteSheetDto,
  FilterRouteSheetsDto,
  PrintRouteSheetDto,
  RouteSheetResponseDto,
  UpdateRouteSheetDto,
  CreateRouteOptimizationDto,
  RouteOptimizationResponseDto,
  CreateVehicleRouteInventoryDto,
  VehicleRouteInventoryResponseDto,
  InventoryTransactionDto,
  ReconcileRouteSheetDto,
  RecordPaymentDto,
  SkipDeliveryDto,
  RouteSheetDetailResponseDto,
  ValidateDeliveryTimesDto,
  DeliveryTimeValidationResponseDto,
  UpdateDeliveryTimeDto,
  GenerateCollectionPdfDto,
  CollectionPdfResponseDto,
} from './dto';
import { RouteSheetService } from './route-sheet.service';
import { RouteOptimizationService } from '../common/services/route-optimization.service';
import { MobileInventoryService } from '../common/services/mobile-inventory.service';
import { Role } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { formatBATimestampISO } from '../common/utils/date.utils';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FailedOrderReassignmentService } from '../common/services/failed-order-reassignment.service';
import { BUSINESS_CONFIG } from '../common/config/business.config';

@ApiTags('🛒 Hojas de Ruta')
@ApiBearerAuth()
@Controller('route-sheets')
export class RouteSheetController {
  constructor(
    private readonly routeSheetService: RouteSheetService,
    private readonly routeOptimizationService: RouteOptimizationService,
    private readonly mobileInventoryService: MobileInventoryService,
    private readonly failedOrderReassignmentService: FailedOrderReassignmentService,
  ) {}

  @Post()
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Crear una nueva hoja de ruta',
    description: `Crea una nueva hoja de ruta con múltiples tipos de entregas y soporte para múltiples zonas por vehículo.

📋 TIPOS DE ÓRDENES SOPORTADAS (pueden mezclarse en una misma hoja):

1️⃣ **Órdenes HYBRID/SUBSCRIPTION/CONTRACT**: Usar order_id + order_type
   - HYBRID: Cobranzas manuales/suscripciones híbridas
   - SUBSCRIPTION: Órdenes de suscripción regulares
   - CONTRACT_DELIVERY: Entregas por contrato

2️⃣ **Compras one-off de un solo producto**: Usar one_off_purchase_id
   - Para compras individuales de la tabla one_off_purchase
   - NO incluir order_type

3️⃣ **Compras one-off con múltiples productos**: Usar one_off_purchase_header_id
   - Para compras con múltiples items de la tabla one_off_purchase_header
   - NO incluir order_type

4️⃣ **Cobros de ciclo de suscripción**: Usar cycle_payment_id
   - Para pagos de ciclos de suscripción
   - NO incluir order_type

5️⃣ **Zonas de la hoja de ruta (opcional)**: Usar zone_ids
   - Array de IDs de zonas asignadas al vehículo
   - Si se especifica, todos los detalles deben pertenecer a estas zonas
   - Validado contra las zonas activas del vehículo

✅ EJEMPLO DE PAYLOAD MEZCLANDO TIPOS:
\`\`\`json
{
  "driver_id": 3,
  "vehicle_id": 1,
  "delivery_date": "2025-10-03",
  "route_notes": "Salir por Sarmiento",
  "zone_ids": [1, 2],
  "details": [
    {
      "order_id": 21,
      "order_type": "HYBRID",
      "delivery_status": "PENDING",
      "delivery_time": "08:00-12:00"
    },
    {
      "one_off_purchase_id": 5,
      "delivery_status": "PENDING",
      "delivery_time": "08:00-12:00"
    },
    {
      "one_off_purchase_header_id": 3,
      "delivery_status": "PENDING",
      "delivery_time": "12:00-16:00"
    }
  ]
}
\`\`\`

⚠️ IMPORTANTE - CÓMO OBTENER IDs CORRECTOS:

1️⃣ **Consultar compras one-off disponibles:**
   GET /api/one-off-purchases/one-off?status=PENDING&requires_delivery=true

2️⃣ **Verificar el campo 'purchase_type' en la respuesta:**
   - Si purchase_type = "LEGACY" → Usar one_off_purchase_id
   - Si purchase_type = "HEADER" → Usar purchase_header_id

3️⃣ **Lógica Frontend para mapear compras:**
\`\`\`javascript
// Ejemplo de cómo procesar la respuesta del API
const oneOffPurchases = response.data.filter(p => p.status === 'PENDING');

const routeDetails = oneOffPurchases.map(purchase => {
  const detail = {
    delivery_status: 'PENDING',
    delivery_time: '08:00-12:00',
  };
  
  // Usar el ID correcto según el tipo
  if (purchase.purchase_type === 'LEGACY') {
    detail.one_off_purchase_id = purchase.one_off_purchase_id;
  } else if (purchase.purchase_type === 'HEADER') {
    detail.one_off_purchase_header_id = purchase.purchase_header_id;
  }
  
  return detail;
});
\`\`\`

📋 **EJEMPLO DE RESPUESTA DEL API:**
{
  "data": [
    {
      "purchase_id": 5,
      "one_off_purchase_id": 5,     ← Usar este ID
      "purchase_type": "LEGACY",     ← Tipo LEGACY
      "status": "PENDING",
      ...
    },
    {
      "purchase_id": 4,
      "purchase_header_id": 4,       ← Usar este ID
      "purchase_type": "HEADER",     ← Tipo HEADER
      "status": "PENDING",
      ...
    }
  ]
}

📋 **PAYLOAD PARA HOJA DE RUTA:**
{
  "driver_id": 2,
  "vehicle_id": 1,
  "delivery_date": "2025-10-04",
  "zone_ids": [3],
  "details": [
    {
      "one_off_purchase_id": 5,      ← Del registro LEGACY
      "delivery_status": "PENDING",
      "delivery_time": "08:00-12:00"
    },
    {
      "one_off_purchase_header_id": 4, ← Del registro HEADER
      "delivery_status": "PENDING",
      "delivery_time": "08:00-12:00"
    }
  ]
}

✅ REGLAS:
- Cada detalle debe tener al menos uno de: order_id, one_off_purchase_id, one_off_purchase_header_id, o cycle_payment_id
- Solo incluir order_type cuando uses order_id
 - NO mezclar purchase_id con los campos específicos (one_off_purchase_id / purchase_header_id)
 - Si se envía zone_ids: deben estar asignadas al vehículo y los detalles deben pertenecer a esas zonas`,
  })
  @ApiBody({ type: CreateRouteSheetDto })
  @ApiResponse({
    status: 201,
    description: 'Hoja de ruta creada exitosamente',
    type: RouteSheetResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: `❌ Datos de entrada inválidos. Posibles causas:
    
    🔸 **Validación de Campos:**
    • driver_id o vehicle_id no existen
    • delivery_date en formato incorrecto (debe ser YYYY-MM-DD)
    • order_type faltante cuando se especifica order_id
    
    🔸 **Conflictos de Órdenes:**
    • Órdenes ya asignadas a otra hoja de ruta
    • IDs de órdenes/compras no existen o están inactivos
    • Mezcla incorrecta de campos (ej: order_id con one_off_purchase_id)
    
    🔸 **Reglas de Negocio:**
    • Al menos un detalle debe especificar: order_id, one_off_purchase_id, one_off_purchase_header_id o cycle_payment_id
    • No se puede usar order_type con compras one-off o cycle payments`,
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Validation failed' },
        error: { type: 'string', example: 'Bad Request' },
        statusCode: { type: 'number', example: 400 },
        details: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'order_type es requerido cuando se especifica order_id',
            'driver_id no existe',
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '🔐 No autorizado - Token JWT faltante, inválido o expirado',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Unauthorized' },
        statusCode: { type: 'number', example: 401 },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description:
      '🚫 Prohibido - El usuario no tiene permisos suficientes para crear hojas de ruta',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Forbidden resource' },
        statusCode: { type: 'number', example: 403 },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description:
      '⚠️ Conflicto - Órdenes ya asignadas a otra hoja de ruta activa',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Las siguientes órdenes ya están asignadas: [21, 15]',
        },
        statusCode: { type: 'number', example: 409 },
        conflictingOrders: {
          type: 'array',
          items: { type: 'number' },
          example: [21, 15],
        },
      },
    },
  })
  create(@Body() createRouteSheetDto: CreateRouteSheetDto) {
    return this.routeSheetService.create(createRouteSheetDto);
  }

  @Get()
  @Auth(
    Role.ADMINISTRATIVE,
    Role.SUPERADMIN,
    Role.BOSSADMINISTRATIVE,
    Role.DRIVERS,
  )
  @ApiOperation({
    summary: 'Listar hojas de ruta con filtros avanzados',
    description: `Obtiene un listado completo de hojas de ruta con capacidades avanzadas de filtrado, búsqueda y paginación para gestión logística.

## 🔍 FILTRADO AVANZADO

**Filtros por Personal y Recursos:**
- **driver_id**: Filtro por conductor específico
- **vehicle_id**: Filtro por vehículo asignado

**Filtros Temporales:**
- **from_date**: Fecha de inicio del rango (YYYY-MM-DD)
- **to_date**: Fecha de fin del rango (YYYY-MM-DD)
- Búsqueda por rangos de fechas para análisis histórico

**Ordenamiento Avanzado:**
- **sortBy**: Múltiples campos con dirección (ej: "delivery_date,-driver.name")
- Campos disponibles: delivery_date, driver.name, vehicle.code
- Prefijo "-" para orden descendente

## 📊 INFORMACIÓN INCLUIDA

**Datos de Hoja de Ruta:**
- ID único de hoja de ruta
- Fecha de entrega programada
- Notas de ruta y observaciones
- Estado general de la ruta

**Información de Personal y Recursos:**
- Datos completos del conductor asignado
- Información detallada del vehículo
- Capacidades y especificaciones técnicas
 - Zonas asignadas al vehículo y zonas cubiertas en la hoja (vehicle.zones, zones_covered)

**Detalles de Entregas:**
- Lista completa de entregas programadas
- Estados de entrega por pedido
- Horarios programados y comentarios
- Información de clientes y productos

**Metadatos de Paginación:**
- Total de registros encontrados
- Página actual y límite por página
- Total de páginas disponibles

## 🎯 CASOS DE USO

- **Gestión Logística**: Supervisión de rutas y entregas diarias
- **Planificación Operativa**: Asignación de recursos y personal
- **Seguimiento de Entregas**: Monitoreo del estado de pedidos
- **Reportes Gerenciales**: Análisis de eficiencia y productividad
- **Control de Calidad**: Verificación de cumplimiento de horarios
- **Auditorías**: Revisión histórica de operaciones logísticas`,
  })
  @ApiQuery({
    name: 'driver_id',
    required: false,
    type: Number,
    description: 'Filtrar por ID del conductor',
  })
  @ApiQuery({
    name: 'vehicle_id',
    required: false,
    type: Number,
    description: 'Filtrar por ID del vehículo',
  })
  @ApiQuery({
    name: 'from_date',
    required: false,
    type: String,
    description: 'Filtrar por fecha desde (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'to_date',
    required: false,
    type: String,
    description: 'Filtrar por fecha hasta (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Resultados por página',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description:
      "Campos para ordenar. Prefijo '-' para descendente. Ej: delivery_date,-driver.name",
    example: 'delivery_date,-driver.name',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de hojas de ruta obtenido exitosamente',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/RouteSheetResponseDto' },
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
    status: 400,
    description: `❌ Parámetros de consulta inválidos:
    
    🔸 **Filtros de Fecha:**
    • from_date o to_date en formato incorrecto (debe ser YYYY-MM-DD)
    • from_date posterior a to_date
    
    🔸 **Paginación:**
    • page o limit con valores negativos o no numéricos
    • limit excede el máximo permitido (${BUSINESS_CONFIG.PAGINATION.MAX_LIMIT})
    
    🔸 **Ordenamiento:**
    • sortBy con campos no válidos
    • Formato de ordenamiento incorrecto`,
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Invalid query parameters' },
        error: { type: 'string', example: 'Bad Request' },
        statusCode: { type: 'number', example: 400 },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '🔐 No autorizado - Token JWT requerido',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Unauthorized' },
        statusCode: { type: 'number', example: 401 },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: '🚫 Prohibido - Rol insuficiente para consultar hojas de ruta',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Forbidden resource' },
        statusCode: { type: 'number', example: 403 },
      },
    },
  })
  findAll(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    filterDto: FilterRouteSheetsDto,
    @GetUser() user: User,
  ) {
    if (user.role === Role.DRIVERS) {
      filterDto.driver_id = user.id;
    }
    return this.routeSheetService.findAll(filterDto);
  }

  @Get(':id')
  @Auth(
    Role.ADMINISTRATIVE,
    Role.SUPERADMIN,
    Role.BOSSADMINISTRATIVE,
    Role.DRIVERS,
  )
  @ApiOperation({
    summary: 'Obtener hoja de ruta específica por ID',
    description: `Devuelve la información completa y detallada de una hoja de ruta específica según su ID único.

## 📋 INFORMACIÓN DEVUELTA

**Identificación:**
- ID único de la hoja de ruta
- Fecha de entrega programada
- Notas de ruta y observaciones especiales
- Estado general de la hoja de ruta

**Detalles del Personal y Recursos:**
- Información completa del conductor asignado (ID, nombre, email)
- Datos detallados del vehículo (ID, código, nombre, descripción)
- Capacidades y especificaciones técnicas del vehículo

**Detalles Completos de Entregas:**
- Lista completa de todas las entregas programadas
- Estados individuales de cada entrega (PENDING, DELIVERED, SKIPPED, etc.)
- Horarios programados y comentarios específicos
- Información detallada de clientes y productos por entrega
- Indicador de entrega actual para el conductor

**Información Operativa:**
- Datos de pedidos de suscripción y compras one-off
- Información de cobranzas y pagos asociados
- Firmas digitales y evidencias de entrega
- Cantidades entregadas y devueltas por producto

## 🎯 CASOS DE USO

- **Consultas Específicas**: Obtener detalles completos de una ruta particular
- **Seguimiento en Tiempo Real**: Monitoreo del progreso de entregas
- **Gestión de Conductores**: Información para el personal de campo
- **Control de Calidad**: Verificación de cumplimiento y evidencias
- **Auditorías**: Revisión detallada de operaciones específicas
- **Resolución de Problemas**: Análisis de incidencias en entregas

## Estructura de Respuesta (Pedidos)

RouteSheetResponseDto:
{
  route_sheet_id: number,
  driver: { id, name, email },
  vehicle: {
    vehicle_id,
    code,
    name,
    zones?: [{ zone_id, code, name, locality: { locality_id, code, name, province: { province_id, code, name, country: { country_id, code, name } } } }]
  },
  delivery_date: string, // YYYY-MM-DD
  route_notes?: string,
  details: [
    {
      route_sheet_detail_id: number,
      route_sheet_id: number,
      order?: {
        order_id: number,
        order_date: string, // ISO
        total_amount: string,
        status: string,
        subscription_id?: number,
        subscription_due_date?: string,
        customer: { person_id, name, alias?, address, phone, zone?, locality?, special_instructions? },
        items: [{ order_item_id, quantity, delivered_quantity, returned_quantity, product: { product_id, description } }],
        notes?: string
      },
      delivery_status: string,
      delivery_time?: string,
      comments?: string,
      digital_signature_id?: string,
      is_current_delivery?: boolean,
      credits?: [{ product_description, planned_quantity, delivered_quantity, remaining_balance }]
    }
  ],
  zones_covered?: [{ zone_id, code, name, locality: { locality_id, code, name, province: { province_id, code, name, country: { country_id, code, name } } } }]
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la hoja de ruta',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Hoja de ruta encontrada exitosamente con todos sus detalles',
    type: RouteSheetResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '
    ❌ ID inválido - El parámetro id debe ser un número entero positivo
    
    ## Interpretación de Vencimientos(Front)
    - Usar \`delivery_date\` de la hoja para comparar.
    - Campo: \`order.subscription_due_date\` (YYYY-MM-DD).
    - Reglas:
      - Igual a \`delivery_date\`: "Vence hoy".
      - Menor a \`delivery_date\`: "Vencido".
      - Mayor a \`delivery_date\`: "Próximo".
    -
    Ejemplo UI: mostrar badge con el estado y la fecha formateada (dd/MM/yyyy).
    ',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Validation failed (numeric string is expected)' },
        error: { type: 'string', example: 'Bad Request' },
        statusCode: { type: 'number', example: 400 }
      }
    }`,
  })
  @ApiResponse({
    status: 401,
    description: '🔐 No autorizado - Token JWT requerido',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Unauthorized' },
        statusCode: { type: 'number', example: 401 },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description:
      '🚫 Prohibido - Rol insuficiente para consultar detalles de hojas de ruta',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Forbidden resource' },
        statusCode: { type: 'number', example: 403 },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description:
      '🔍 Hoja de ruta no encontrada - No existe una hoja de ruta con el ID especificado',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Route sheet with ID 123 not found',
        },
        error: { type: 'string', example: 'Not Found' },
        statusCode: { type: 'number', example: 404 },
      },
    },
  })
  async findOne(@Param('id', ParseIntPipe) id: number, @GetUser() user: User) {
    await this.routeSheetService.assertDriverCanAccess(id, user);
    return this.routeSheetService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({ summary: 'Actualizar una hoja de ruta' })
  @ApiParam({
    name: 'id',
    description: 'ID de la hoja de ruta a actualizar',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateRouteSheetDto })
  @ApiResponse({
    status: 200,
    description: 'Hoja de ruta actualizada',
    type: RouteSheetResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 404, description: 'Hoja de ruta no encontrada' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRouteSheetDto: UpdateRouteSheetDto,
  ) {
    return this.routeSheetService.update(id, updateRouteSheetDto);
  }

  @Delete(':id')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Eliminar una hoja de ruta',
    description:
      'Desactiva la hoja de ruta (soft delete) y revierte a "PENDING" el estado de todos los pedidos asociados a esa hoja (suscripciones y compras one-off).',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la hoja de ruta a eliminar',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description:
      'Hoja de ruta desactivada y estados de pedidos revertidos a PENDING',
    schema: {
      properties: {
        message: {
          type: 'string',
          example:
            'Hoja de Ruta con ID 123 desactivada y pedidos revertidos a PENDING',
        },
        deleted: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Hoja de ruta no encontrada' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.routeSheetService.remove(id);
  }

  @Post('print')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Generar e imprimir una hoja de ruta',
    description: `Genera un documento PDF con la hoja de ruta completa y listado de entregas.

## Estructura del PDF (Pedidos)

Campos principales que el PDF utiliza (derivados de la respuesta de hoja de ruta):
- route_sheet_id (number)
- delivery_date (YYYY-MM-DD)
- driver: { id, name, email }
- vehicle: { vehicle_id, code, name, zones: [{ zone_id, code, name, locality: { ... } }] }
- route_notes (string)
- zones_covered: [{ zone_id, code, name, locality: { ... } }]
- details: [
  {
    route_sheet_detail_id,
    route_sheet_id,
    order: {
      order_id,
      order_date (ISO),
      total_amount (string),
      status,
      subscription_id?,
      subscription_due_date?,
      customer: { person_id, name, alias?, address, phone, locality?, zone?, special_instructions? },
      items: [{ order_item_id, quantity, delivered_quantity, returned_quantity, product: { product_id, description } }],
      notes?
    },
    delivery_status,
    delivery_time?,
    is_current_delivery,
    comments?,
    credits?: [{ product_description, planned_quantity, delivered_quantity, remaining_balance }]
  }
]

Notas:
- Si el cliente tiene suscripción, se incluye subscription_due_date (vencimiento del ciclo actual).
- Las "Notas" del PDF combinan observaciones del pedido y las instrucciones especiales del cliente.
`,
  })
  @ApiBody({ type: PrintRouteSheetDto })
  @ApiResponse({
    status: 200,
    description: 'Documento generado correctamente',
    schema: {
      properties: {
        url: { type: 'string' },
        filename: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Hoja de ruta no encontrada' })
  print(@Body() printRouteSheetDto: PrintRouteSheetDto) {
    return this.routeSheetService.generatePrintableDocument(
      printRouteSheetDto.route_sheet_id,
      {
        format: printRouteSheetDto.format,
        includeMap: printRouteSheetDto.include_map,
        includeSignatureField: printRouteSheetDto.include_signature_field,
        includeProductDetails: printRouteSheetDto.include_product_details,
      },
    );
  }

  // Endpoints de optimización de rutas

  @Post(':id/optimize')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Optimizar una hoja de ruta',
    description: 'Calcula la ruta óptima para las entregas',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la hoja de ruta a optimizar',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Ruta optimizada correctamente',
    type: RouteOptimizationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Hoja de ruta no encontrada' })
  optimizeRoute(
    @Param('id', ParseIntPipe) id: number,
    @Body() optimizationDto: CreateRouteOptimizationDto,
  ) {
    // Asegurar que el ID en el DTO coincide con el de la ruta
    optimizationDto.route_sheet_id = id;
    return this.routeOptimizationService.optimizeRoute(optimizationDto);
  }

  @Get(':id/optimization')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener la optimización de una hoja de ruta',
    description:
      'Devuelve la última optimización calculada para una hoja de ruta',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la hoja de ruta para obtener su optimización',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Optimización encontrada',
    type: RouteOptimizationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'No se encontró optimización para la hoja de ruta',
  })
  getRouteOptimization(@Param('id', ParseIntPipe) id: number) {
    return this.routeOptimizationService.getRouteOptimization(id);
  }

  // Endpoints de inventario móvil

  @Post(':id/inventory')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Inicializar inventario para una hoja de ruta',
    description: 'Registra el inventario inicial cargado en el vehículo',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la hoja de ruta para inicializar inventario',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Inventario inicializado correctamente',
    type: VehicleRouteInventoryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos o inventario ya existente',
  })
  initializeInventory(
    @Param('id', ParseIntPipe) id: number,
    @Body() inventoryDto: CreateVehicleRouteInventoryDto,
  ) {
    // Asegurar que el ID en el DTO coincide con el de la ruta
    inventoryDto.route_sheet_id = id;
    return this.mobileInventoryService.initializeRouteInventory(inventoryDto);
  }

  @Get(':id/inventory')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener el inventario de una hoja de ruta',
    description: 'Muestra el estado actual del inventario en el vehículo',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la hoja de ruta para obtener su inventario',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Inventario encontrado',
    type: VehicleRouteInventoryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'No se encontró inventario para la hoja de ruta',
  })
  getInventory(@Param('id', ParseIntPipe) id: number) {
    return this.mobileInventoryService.getRouteInventory(id);
  }

  @Post(':id/inventory/transaction')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Registrar una transacción de inventario',
    description:
      'Registra entregas, devoluciones o cargas adicionales en el inventario',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la hoja de ruta para la transacción de inventario',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Transacción registrada correctamente',
    type: VehicleRouteInventoryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos o inventario insuficiente',
  })
  registerInventoryTransaction(
    @Param('id', ParseIntPipe) id: number,
    @Body() transactionDto: InventoryTransactionDto,
  ) {
    // Asegurar que el ID en el DTO coincide con el de la ruta
    transactionDto.route_sheet_id = id;
    return this.mobileInventoryService.registerInventoryTransaction(
      transactionDto,
    );
  }

  @Get(':id/inventory/alerts')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Verificar alertas de inventario bajo',
    description:
      'Chequea si hay productos con inventario insuficiente para completar todas las entregas',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la hoja de ruta para verificar alertas',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Verificación de alertas completada',
    schema: {
      properties: {
        route_sheet_id: { type: 'number' },
        has_alerts: { type: 'boolean' },
        alerts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'number' },
              product_description: { type: 'string' },
              current_quantity: { type: 'number' },
              required_quantity: { type: 'number' },
              shortage: { type: 'number' },
            },
          },
        },
      },
    },
  })
  checkInventoryAlerts(@Param('id', ParseIntPipe) id: number) {
    return this.mobileInventoryService.checkLowInventoryAlerts(id);
  }

  @Post(':id/reconcile-driver')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Registrar la rendición de una hoja de ruta por el chofer',
    description:
      'Guarda la firma de conformidad del chofer para la rendición de la hoja de ruta.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la hoja de ruta a rendir',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: ReconcileRouteSheetDto })
  @ApiResponse({
    status: 200,
    description: 'Rendición registrada exitosamente',
    type: RouteSheetResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos o la hoja de ruta ya fue rendida',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Hoja de ruta no encontrada' })
  reconcileByDriver(
    @Param('id', ParseIntPipe) id: number,
    @Body() reconcileDto: ReconcileRouteSheetDto,
  ) {
    return this.routeSheetService.reconcileRouteSheetByDriver(id, reconcileDto);
  }

  @Post('details/:detailId/payments')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary:
      'Registrar un pago para una entrega específica de una hoja de ruta',
    description:
      'Permite al chofer (o un admin) registrar un pago en efectivo o QR para una entrega.',
  })
  @ApiParam({
    name: 'detailId',
    description: 'ID del detalle de la hoja de ruta para el pago',
    type: Number,
    example: 101,
  })
  @ApiResponse({ status: 201, description: 'Pago registrado exitosamente.' })
  @ApiResponse({
    status: 400,
    description:
      'Datos de entrada inválidos (ej. monto incorrecto, método de pago no válido).',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 404,
    description:
      'Detalle de hoja de ruta, pedido o método de pago no encontrado.',
  })
  async recordPaymentForDelivery(
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body(ValidationPipe) recordPaymentDto: RecordPaymentDto,
    @GetUser() user: User,
  ) {
    return this.routeSheetService.recordPaymentForDelivery(
      detailId,
      recordPaymentDto,
      user.id,
    );
  }

  @Put('details/:detailId/skip')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Omitir una entrega (marcar como no entregada por el chofer)',
  })
  @ApiParam({
    name: 'detailId',
    description: 'ID del detalle de la hoja de ruta',
    type: 'number',
  })
  @ApiBody({ type: SkipDeliveryDto })
  @ApiResponse({
    status: 200,
    description: 'Entrega omitida exitosamente.',
    type: RouteSheetDetailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o la entrega no se puede omitir.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 404,
    description: 'Detalle de hoja de ruta no encontrado.',
  })
  async skipDelivery(
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body() skipDeliveryDto: SkipDeliveryDto,
    @GetUser() user: User,
  ) {
    return this.routeSheetService.skipDelivery(detailId, skipDeliveryDto, user);
  }

  @Post('validate-delivery-times')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Validar horarios de entrega contra preferencias de suscripción',
    description:
      'Valida que los horarios de entrega propuestos respeten las preferencias de horario de los clientes con suscripción',
  })
  @ApiBody({
    description: 'Lista de pedidos con horarios de entrega propuestos',
    type: ValidateDeliveryTimesDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Validación completada',
    type: [DeliveryTimeValidationResponseDto],
  })
  async validateDeliveryTimes(@Body() body: ValidateDeliveryTimesDto) {
    const validations: DeliveryTimeValidationResponseDto[] = [];

    for (const delivery of body.deliveries) {
      const validation =
        await this.routeSheetService.validateDeliveryTimeAgainstSubscription(
          delivery.order_id,
          delivery.proposed_delivery_time,
        );

      // Obtener información adicional del cliente
      const order = await this.routeSheetService.order_header.findUnique({
        where: { order_id: delivery.order_id },
        include: {
          customer: true,
          customer_subscription: {
            include: {
              subscription_delivery_schedule: true,
            },
          },
        },
      });

      validations.push({
        order_id: delivery.order_id,
        customer_name: order?.customer?.name || 'Cliente desconocido',
        is_valid: validation.isValid,
        message: validation.message,
        suggested_time: validation.suggestedTime,
        preferred_schedules:
          order?.customer_subscription?.subscription_delivery_schedule || [],
      });
    }

    return { validations };
  }

  @Patch(':detailId/delivery-time')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Actualizar horario de entrega de un detalle de hoja de ruta',
    description:
      'Actualiza el horario de entrega de un detalle específico con validación contra las preferencias de suscripción del cliente',
  })
  @ApiParam({
    name: 'detailId',
    description: 'ID del detalle de hoja de ruta',
    example: 1,
  })
  @ApiBody({
    description: 'Nuevo horario de entrega',
    type: UpdateDeliveryTimeDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Horario de entrega actualizado exitosamente',
    type: RouteSheetDetailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Horario inválido o datos de entrada incorrectos',
  })
  @ApiResponse({
    status: 404,
    description: 'Detalle de hoja de ruta no encontrado',
  })
  async updateDeliveryTime(
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body() updateDeliveryTimeDto: UpdateDeliveryTimeDto,
  ) {
    return this.routeSheetService.updateDeliveryTime(
      detailId,
      updateDeliveryTimeDto,
    );
  }

  @Post('failed-orders/reassign')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Ejecutar manualmente la reasignación de pedidos fallidos',
  })
  @ApiResponse({
    status: 200,
    description: 'Reasignación ejecutada exitosamente',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        reassignedCount: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async forceReassignFailedOrders() {
    const result =
      await this.failedOrderReassignmentService.reassignFailedOrders();
    return {
      message: 'Reasignación de pedidos fallidos ejecutada exitosamente',
      reassignedCount: result,
    };
  }

  @Get('failed-orders/stats')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({ summary: 'Obtener estadísticas de pedidos fallidos' })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas de pedidos fallidos',
    schema: {
      type: 'object',
      properties: {
        totalFailed: { type: 'number' },
        pendingReassignment: { type: 'number' },
        reassignedToday: { type: 'number' },
      },
    },
  })
  async getFailedOrderStats() {
    return this.failedOrderReassignmentService.getFailedOrdersStats();
  }

  @Post(':id/generate-collection-pdf')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Generar PDF de hoja de ruta de cobranzas automáticas',
    description: `Genera un PDF específico para hojas de ruta que contienen cobranzas automáticas (cycle payments).

## 📋 FUNCIONALIDAD

**Propósito:**
- Genera un PDF optimizado para cobranzas automáticas
- Incluye solo los detalles de la hoja de ruta que corresponden a cycle_payment_id
- Formato específico para gestión de cobranzas

**Información Incluida:**
- Datos de la hoja de ruta (ID, fecha, notas)
- Información del conductor y vehículo
- Tabla detallada de cobranzas con:
  - Datos del cliente (nombre, dirección, teléfono)
  - Monto a cobrar
  - Fecha de vencimiento principal y conteo de vencimientos adicionales del mismo día
  - Plan de suscripción
  - Estado de pago
  - Horario programado

## Estructura del PDF (Cobranzas)

Cada cobranza mapeada incluye:
{
  cycle_payment_id: number,
  customer: { customer_id, name, address, phone, zone?, locality? },
  amount: number,
  payment_due_date: 'YYYY-MM-DD',
  all_due_dates?: string[],
  cycle_period: string,
  subscription_plan: string,
  payment_status: string,
  delivery_status: string,
  delivery_time?: string,
  comments?: string,
  subscription_id?: number,
  credits?: [{ product_description, planned_quantity, delivered_quantity, remaining_balance }]
}

Notas:
- En la columna "Venc.", si hay múltiples abonos con vencimiento en el día, se muestra "(+N)".
- En "Notas" se agregan "Cuotas vencidas: dd/MM/yyyy, ..." cuando existan.
 - La columna "Estado" del PDF refleja el estado de pago (payment_status).
 - En la columna "Monto":
   - Si el cliente tiene un único abono activo y posee cuotas impagas, se muestra la suma total de los saldos pendientes de ese abono.
   - Si el cliente tiene múltiples abonos, se generan filas separadas por cada abono, cada una con su propio monto y vencimiento.

## 🎯 CASOS DE USO

- **Gestión de Cobranzas**: PDF específico para conductores que realizan cobranzas
- **Control de Pagos**: Seguimiento de pagos de suscripciones automáticas
- **Documentación**: Registro físico de cobranzas realizadas
- **Auditoría**: Evidencia de gestión de cobranzas automáticas

## ⚠️ VALIDACIONES

- La hoja de ruta debe existir
- Debe contener al menos una cobranza automática (cycle_payment_id)
- Solo incluye detalles con cycle_payment_id válido`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la hoja de ruta para generar PDF de cobranzas',
    type: Number,
    example: 123,
  })
  @ApiBody({
    description: 'Opciones para la generación del PDF',
    type: GenerateCollectionPdfDto,
    required: false,
  })
  @ApiResponse({
    status: 201,
    description: 'PDF de cobranzas generado exitosamente',
    type: CollectionPdfResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'La hoja de ruta no contiene cobranzas automáticas',
  })
  @ApiResponse({
    status: 404,
    description: 'Hoja de ruta no encontrada',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async generateCollectionPdf(
    @Param('id', ParseIntPipe) id: number,
    @Body() generatePdfDto: GenerateCollectionPdfDto = {},
  ): Promise<CollectionPdfResponseDto> {
    const result = await this.routeSheetService.generateCollectionRouteSheetPdf(
      id,
      generatePdfDto,
    );

    return {
      url: result.url,
      filename: result.filename,
      route_sheet_id: id,
      generated_at: formatBATimestampISO(new Date()),
      total_collections: result.total_collections,
    };
  }
}
