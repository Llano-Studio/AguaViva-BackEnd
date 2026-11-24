import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DELIVERY_CREATED_EVENT,
  DeliveryCreatedEvent,
} from '../route-sheet/extra-deliveries/extra-delivery.events';
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
} from '@nestjs/common';
import { OneOffPurchaseService } from './one-off-purchase.service';
import { CreateOneOffPurchaseDto } from './dto/create-one-off-purchase.dto';
import { UpdateOneOffPurchaseDto } from './dto/update-one-off-purchase.dto';
import { FilterOneOffPurchasesDto } from './dto/filter-one-off-purchases.dto';
import { OneOffPurchaseResponseDto } from './dto/one-off-purchase-response.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('Compras de Una Vez')
@ApiBearerAuth()
@Controller('one-off-purchases')
export class OneOffPurchaseController {
  constructor(
    private readonly oneOffPurchaseService: OneOffPurchaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post('one-off')
  @Auth(
    Role.ADMINISTRATIVE,
    Role.SUPERADMIN,
    Role.BOSSADMINISTRATIVE,
    Role.DRIVERS,
  )
  @ApiOperation({
    summary:
      'Crear una nueva compra one-off (con verificación automática de cliente)',
    description: `Crea una nueva compra de una sola vez con verificación automática del cliente por teléfono.

## 🆕 FUNCIONALIDAD INTELIGENTE

**Verificación Automática por Teléfono:**
- El frontend SIEMPRE envía el \`phone\` del cliente
- El sistema busca si el cliente ya existe por teléfono
- Si existe → usa el cliente existente y crea la orden
- Si no existe → crea el cliente nuevo y luego la orden

**Flujo del Frontend:**
1. Usuario ingresa teléfono en el formulario
2. Frontend envía todos los datos del cliente (incluyendo teléfono)
3. Backend verifica si el cliente existe por teléfono
4. Si existe → reutiliza el cliente existente
5. Si no existe → crea nuevo cliente con los datos proporcionados
6. Crea la orden one-off asociada al cliente

**Casos de Uso:**
- Cliente existente: Se reutiliza automáticamente
- Cliente nuevo: Se crea automáticamente
- Flexibilidad total en el método de registro

**🆕 CONTROL DE STATUS AUTOMÁTICO:**
- Si \`requires_delivery = false\` → Status = 'RETIRADO' (producto retirado en local)
- Si \`requires_delivery = true\` → Status = 'PENDING' (pendiente de entrega)
- Si se especifica \`status\` explícitamente → Se usa el valor proporcionado

🔍 VALIDACIONES IMPLEMENTADAS:
• Verificación de existencia de product_id
• Verificación de existencia de price_list_id (si se proporciona)
• Validación de que paid_amount sea igual a total_amount (si se proporciona)
• Cálculo automático de total_amount basado en precio y cantidad
• Control automático de status según tipo de entrega`,
  })
  @ApiBody({ type: CreateOneOffPurchaseDto })
  @ApiResponse({
    status: 201,
    description:
      'Compra one-off creada exitosamente. La respuesta incluye información detallada del producto y lista de precios utilizada.',
    type: OneOffPurchaseResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos de entrada inválidos. Posibles errores: product_id no existe, price_list_id no existe, paid_amount no coincide con total_amount.',
  })
  @ApiResponse({
    status: 404,
    description: 'Producto o entidad relacionada no encontrada.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto de stock o restricción única.',
  })
  async createOneOffPurchase(
    @Body(ValidationPipe) createDto: CreateOneOffPurchaseDto,
  ): Promise<OneOffPurchaseResponseDto> {
    const purchase =
      await this.oneOffPurchaseService.createOneOffWithCustomerLogic(createDto);
    // Si ya hay hoja de ruta para esa fecha y zona, se suma como extra.
    if (purchase.purchase_header_id) {
      this.eventEmitter.emit(DELIVERY_CREATED_EVENT, {
        kind: 'one_off_purchase_header',
        id: purchase.purchase_header_id,
      } satisfies DeliveryCreatedEvent);
    }
    return purchase;
  }

  @Get('one-off')
  @Auth(
    Role.ADMINISTRATIVE,
    Role.SUPERADMIN,
    Role.BOSSADMINISTRATIVE,
    Role.DRIVERS,
  )
  @ApiOperation({
    summary: 'Obtener todas las compras one-off con filtros opcionales',
    description: `Retorna una lista paginada de compras one-off con opciones de filtrado avanzado.
        
📋 INFORMACIÓN INCLUIDA EN LA RESPUESTA:
• Datos completos del producto y cantidad
• Información de la lista de precios utilizada (si aplica)
• Detalles del cliente, canal de venta, localidad y zona
• Fechas de compra y entrega programada
• Montos total y pagado`,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Búsqueda general por nombre de cliente, teléfono, ID de compra o descripción de producto',
  })
  @ApiQuery({
    name: 'customerName',
    required: false,
    description: 'Filtrar por nombre del cliente',
  })
  @ApiQuery({
    name: 'productName',
    required: false,
    description: 'Filtrar por descripción del producto',
  })
  @ApiQuery({
    name: 'purchaseDateFrom',
    required: false,
    description: 'Filtrar por fecha de compra desde (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'purchaseDateTo',
    required: false,
    description: 'Filtrar por fecha de compra hasta (YYYY-MM-DD)',
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
    name: 'person_id',
    required: false,
    description: 'Filtrar por ID del cliente',
    type: Number,
  })
  @ApiQuery({
    name: 'product_id',
    required: false,
    description: 'Filtrar por ID del producto',
    type: Number,
  })
  @ApiQuery({
    name: 'sale_channel_id',
    required: false,
    description: 'Filtrar por ID del canal de venta',
    type: Number,
  })
  @ApiQuery({
    name: 'locality_id',
    required: false,
    description: 'Filtrar por ID de localidad',
    type: Number,
  })
  @ApiQuery({
    name: 'zone_id',
    required: false,
    description: 'Filtrar por ID de zona',
    type: Number,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description:
      'Filtrar por estado de la orden (PENDING, RETIRADO, DELIVERED, CANCELLED)',
    type: String,
    example: 'PENDING',
  })
  @ApiQuery({
    name: 'requires_delivery',
    required: false,
    description: 'Filtrar por si requiere entrega (true/false)',
    type: Boolean,
    example: true,
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
    description: 'Límite de resultados por página',
    type: Number,
    example: 10,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Ordenamiento (ej: purchase_date:desc)',
    example: 'purchase_date:desc',
  })
  @ApiResponse({
    status: 200,
    description: `Lista de compras one-off obtenida exitosamente.

🎯 IMPORTANTE PARA HOJAS DE RUTA:
Cada compra incluye el campo 'purchase_type' que indica qué ID usar al crear hojas de ruta:
- Si purchase_type = "LEGACY" → usar one_off_purchase_id
- Si purchase_type = "HEADER" → usar purchase_header_id

✅ EJEMPLO DE RESPUESTA con ambos tipos:`,
    schema: {
      example: {
        data: [
          {
            purchase_id: 5,
            one_off_purchase_id: 5,
            purchase_type: 'LEGACY',
            person_id: 10,
            purchase_date: '2025-10-04T00:00:00.000Z',
            total_amount: '1920',
            paid_amount: '1920',
            status: 'PENDING',
            order_type: 'ONE_OFF',
            requires_delivery: true,
            person: { name: 'Juan Pérez', phone: '3625123456' },
            products: [
              { product_id: 1, description: 'Botella 500ml', quantity: 2 },
            ],
            _comment:
              '⬆️ Compra LEGACY (1 producto) - Usar one_off_purchase_id: 5 en hoja de ruta',
          },
          {
            purchase_id: 4,
            purchase_header_id: 4,
            purchase_type: 'HEADER',
            person_id: 8,
            purchase_date: '2025-10-03T00:00:00.000Z',
            total_amount: '25920',
            paid_amount: '25920',
            status: 'PENDING',
            order_type: 'ONE_OFF',
            requires_delivery: true,
            person: { name: 'María García', phone: '3625987654' },
            products: [
              { product_id: 1, description: 'Botella 500ml', quantity: 2 },
              { product_id: 2, description: 'Dispenser', quantity: 1 },
            ],
            _comment:
              '⬆️ Compra HEADER (múltiples productos) - Usar purchase_header_id: 4 en hoja de ruta',
          },
        ],
        meta: {
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      },
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/OneOffPurchaseResponseDto' },
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
  async findAllOneOffPurchases(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: false },
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    filterOneOffPurchasesDto: FilterOneOffPurchasesDto,
  ): Promise<any> {
    return this.oneOffPurchaseService.findAllOneOff(filterOneOffPurchasesDto);
  }

  @Get('one-off/:id')
  @Auth(
    Role.ADMINISTRATIVE,
    Role.SUPERADMIN,
    Role.BOSSADMINISTRATIVE,
    Role.DRIVERS,
  )
  @ApiOperation({
    summary: 'Obtener una compra one-off por su ID',
    description: `Retorna los detalles completos de una compra one-off específica.
        
📋 INFORMACIÓN INCLUIDA:
• Datos completos del producto y cantidad
• Información de la lista de precios utilizada (nombre, ID y precio unitario)
• Detalles del cliente (nombre, teléfono)
• Canal de venta, localidad y zona
• Fechas de compra y entrega programada
• Montos total y pagado, notas adicionales`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la compra one-off',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description:
      'Compra one-off encontrada exitosamente. Incluye información detallada del producto y lista de precios utilizada.',
    type: OneOffPurchaseResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Compra one-off no encontrada.' })
  findOneOneOffPurchase(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<OneOffPurchaseResponseDto> {
    return this.oneOffPurchaseService.findOneOneOff(id);
  }

  @Patch('one-off/:id')
  @Auth(
    Role.ADMINISTRATIVE,
    Role.SUPERADMIN,
    Role.BOSSADMINISTRATIVE,
    Role.DRIVERS,
  )
  @ApiOperation({
    summary: 'Actualizar una compra one-off por su ID',
    description: `Actualiza los detalles de una compra one-off existente.
        
✅ ACTUALIZACIONES FLEXIBLES:
• **Actualización de estado únicamente**: Solo enviar { "status": "DELIVERED" }
• **Actualización de productos**: Requiere items y sale_channel_id
• **Actualización de cliente**: Solo campos del cliente
• **Actualización mixta**: Cualquier combinación de campos

⚠️ CAMPOS REQUERIDOS SEGÚN TIPO DE ACTUALIZACIÓN:
• **Solo estado/notas/dirección**: No requiere items ni sale_channel_id
• **Modificación de productos**: Requiere items (array con al menos un producto) y sale_channel_id

🔍 VALIDACIONES APLICADAS:
• Verificación de existencia de product_id (si se proporcionan items)
• Verificación de existencia de price_list_id (si se proporciona)
• Validación de que paid_amount sea igual a total_amount (si se proporciona)
• Recálculo automático de total_amount basado en precio y cantidad (si se modifican items)
• Actualización automática de movimientos de stock para productos no retornables`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la compra one-off a actualizar',
    type: Number,
  })
  @ApiBody({ type: UpdateOneOffPurchaseDto })
  @ApiResponse({
    status: 200,
    description:
      'Compra one-off actualizada exitosamente. La respuesta incluye información actualizada del producto y lista de precios.',
    type: OneOffPurchaseResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Compra one-off no encontrada.' })
  @ApiResponse({
    status: 400,
    description:
      'Datos de entrada inválidos. Posibles errores: product_id no existe, price_list_id no existe, paid_amount no coincide con total_amount, falta items o sale_channel_id (solo cuando se modifican productos).',
  })
  updateOneOffPurchase(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateOneOffPurchaseDto: UpdateOneOffPurchaseDto,
  ): Promise<OneOffPurchaseResponseDto> {
    return this.oneOffPurchaseService.updateOneOff(id, updateOneOffPurchaseDto);
  }

  @Delete('one-off/:id')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar una compra one-off por su ID',
    description: `Elimina una compra one-off y renueva el stock de productos no retornables usando la lógica unificada.

⚠️ **RESTRICCIONES IMPORTANTES:**
- No se puede eliminar una compra que esté incluida en hojas de ruta activas
- El sistema verificará automáticamente si la compra está asignada a conductores
- Si hay conflictos, se mostrará información detallada de las hojas de ruta afectadas

🔍 **VALIDACIONES APLICADAS:**
• Verificación de existencia de la compra
• Verificación de referencias en hojas de ruta activas
• Restauración automática de stock para productos no retornables

**Disponible para:** SUPERADMIN y Jefe Administrativo`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la compra one-off a eliminar',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Compra one-off eliminada exitosamente.',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example:
            'Compra One-Off con ID 123 eliminada exitosamente. El stock de productos no retornables ha sido renovado.',
        },
        deleted: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Compra one-off no encontrada.' })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto: La compra está incluida en hojas de ruta activas y no puede ser eliminada. El mensaje incluye detalles específicos de las hojas de ruta afectadas.',
  })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene permisos suficientes.',
  })
  async removeOneOffPurchase(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; deleted: boolean }> {
    return this.oneOffPurchaseService.removeOneOff(id);
  }
}
