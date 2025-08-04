import { Controller, Get, Post, Body, Param, Delete, Query, ParseIntPipe, HttpCode, HttpStatus, ValidationPipe, Patch, BadRequestException } from '@nestjs/common';
import { MultiOneOffPurchaseService } from './multi-one-off-purchase.service';
import { CreateMultiOneOffPurchaseDto } from './dto/create-multi-one-off-purchase.dto';
import { FilterMultiOneOffPurchasesDto } from './dto/filter-multi-one-off-purchases.dto';
import { MultiOneOffPurchaseResponseDto } from './dto/multi-one-off-purchase-response.dto';
import { CreateOneOffPurchaseDto } from './dto/create-one-off-purchase.dto';
import { UpdateOneOffPurchaseDto } from './dto/update-one-off-purchase.dto';
import { FilterOneOffPurchasesDto } from './dto/filter-one-off-purchases.dto';
import { OneOffPurchaseResponseDto } from './dto/one-off-purchase-response.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';
import { BUSINESS_CONFIG } from '../common/config/business.config';

@ApiTags('Compras Múltiples de Una Vez (Nuevo)')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
@Controller('multi-one-off-purchases')
export class MultiOneOffPurchaseController {
    constructor(private readonly multiOneOffPurchaseService: MultiOneOffPurchaseService) {}

    @Post()
    @ApiOperation({ 
        summary: 'Crear una nueva compra múltiple one-off (con gestión automática de cliente)',
        description: `Crea una nueva compra múltiple de una sola vez con gestión automática del cliente.

## 🆕 FUNCIONALIDAD INTELIGENTE

**Gestión Automática de Cliente:**
- Si se proporciona \`person_id\` → usa el cliente existente
- Si se proporciona \`customer\` → busca o crea cliente automáticamente
- Si no se proporciona ninguno → error (debe especificar cliente)

**Casos de Uso:**
- Cliente existente: Proporcionar \`person_id\`
- Cliente nuevo: Proporcionar \`customer\` con datos mínimos
- Flexibilidad total en el método de registro

**Compatibilidad:**
- Mantiene compatibilidad con el endpoint anterior
- Agrega funcionalidad de registro automático
- Un solo endpoint para todos los casos

**Ventajas sobre one-off simple:**
- Múltiples productos en una sola compra
- Listas de precios individuales por producto
- Mejor gestión de stock y precios`
    })
    @ApiBody({ 
        type: 'object',
        schema: {
            oneOf: [
                {
                    type: 'object',
                    properties: {
                        person_id: { type: 'number', description: 'ID del cliente existente' },
                        items: { type: 'array', items: { type: 'object' } },
                        sale_channel_id: { type: 'number' },
                        // ... otros campos
                    },
                    required: ['person_id', 'items', 'sale_channel_id']
                },
                {
                    type: 'object',
                    properties: {
                        customer: { type: 'object', description: 'Datos del cliente a registrar' },
                        items: { type: 'array', items: { type: 'object' } },
                        sale_channel_id: { type: 'number' },
                        requires_delivery: { type: 'boolean' },
                        // ... otros campos
                    },
                    required: ['customer', 'items', 'sale_channel_id', 'requires_delivery']
                }
            ]
        }
    })
    @ApiResponse({ 
        status: 201, 
        description: 'Compra múltiple one-off creada exitosamente.',
        type: MultiOneOffPurchaseResponseDto
    })
    @ApiResponse({ status: 400, description: 'Datos de entrada inválidos o cliente no especificado.' })
    @ApiResponse({ status: 404, description: 'Cliente, producto o entidad relacionada no encontrada.' })
    @ApiResponse({ status: 409, description: 'Conflicto de stock o restricción única.' })
    create(
        @Body(ValidationPipe) createMultiOneOffPurchaseDto: CreateMultiOneOffPurchaseDto
    ): Promise<MultiOneOffPurchaseResponseDto> {
        return this.multiOneOffPurchaseService.create(createMultiOneOffPurchaseDto);
    }

    @Get()
    @ApiOperation({ 
        summary: '🆕 Obtener todas las compras múltiples de una sola vez',
        description: 'Retorna una lista paginada de compras múltiples de una sola vez con opciones de filtrado avanzado. Cada compra puede contener múltiples productos.'
    })
    @ApiQuery({ name: 'search', required: false, description: 'Búsqueda general por nombre de cliente, ID de compra o descripción de producto' })
    @ApiQuery({ name: 'customerName', required: false, description: 'Filtrar por nombre del cliente' })
    @ApiQuery({ name: 'productName', required: false, description: 'Filtrar por descripción del producto' })
    @ApiQuery({ name: 'purchaseDateFrom', required: false, description: 'Filtrar por fecha de compra desde (YYYY-MM-DD)' })
    @ApiQuery({ name: 'purchaseDateTo', required: false, description: 'Filtrar por fecha de compra hasta (YYYY-MM-DD)' })
    @ApiQuery({ name: 'deliveryDateFrom', required: false, description: 'Filtrar por fecha de entrega desde (YYYY-MM-DD)' })
    @ApiQuery({ name: 'deliveryDateTo', required: false, description: 'Filtrar por fecha de entrega hasta (YYYY-MM-DD)' })
    @ApiQuery({ name: 'person_id', required: false, description: 'Filtrar por ID del cliente', type: Number })
    @ApiQuery({ name: 'product_id', required: false, description: 'Filtrar por ID del producto', type: Number })
    @ApiQuery({ name: 'sale_channel_id', required: false, description: 'Filtrar por ID del canal de venta', type: Number })
    @ApiQuery({ name: 'locality_id', required: false, description: 'Filtrar por ID de localidad', type: Number })
    @ApiQuery({ name: 'zone_id', required: false, description: 'Filtrar por ID de zona', type: Number })
    @ApiQuery({ name: 'price_list_id', required: false, description: 'Filtrar por ID de lista de precios', type: Number })
    @ApiQuery({ name: 'status', required: false, description: 'Filtrar por estado de la compra', enum: ['PENDING', 'CONFIRMED', 'CANCELLED'] })
    @ApiQuery({ name: 'payment_status', required: false, description: 'Filtrar por estado del pago', enum: ['PENDING', 'PARTIAL', 'PAID'] })
    @ApiQuery({ name: 'delivery_status', required: false, description: 'Filtrar por estado de la entrega', enum: ['PENDING', 'IN_TRANSIT', 'DELIVERED', 'FAILED'] })
    @ApiQuery({ name: 'page', required: false, description: 'Número de página', type: Number })
    @ApiQuery({ name: 'limit', required: false, description: 'Límite de resultados por página', type: Number })
    @ApiQuery({ name: 'sortBy', required: false, description: "Campos para ordenar. Prefijo '-' para descendente. Ej: -purchase_date,person.name", type: String, example: '-purchase_date,person.name' })
    @ApiResponse({ 
        status: 200, 
        description: 'Lista de compras múltiples obtenida exitosamente.',
        schema: {
            properties: {
                data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/MultiOneOffPurchaseResponseDto' }
                },
                meta: {
                    type: 'object',
                    properties: {
                        total: { type: 'number' },
                        page: { type: 'number' },
                        limit: { type: 'number' },
                        totalPages: { type: 'number' }
                    }
                }
            }
        }
    })
    async findAllMultiOneOffPurchases(
        @Query(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true } }))
        filterMultiOneOffPurchasesDto: FilterMultiOneOffPurchasesDto
    ): Promise<{ data: MultiOneOffPurchaseResponseDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
        return this.multiOneOffPurchaseService.findAll(filterMultiOneOffPurchasesDto);
    }

    // ===== ONE-OFF PURCHASES ENDPOINTS =====

    @Post('one-off')
    @ApiOperation({ 
        summary: 'Crear una nueva compra one-off (con verificación automática de cliente)',
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
- Flexibilidad total en el método de registro`
    })
    @ApiBody({ type: CreateOneOffPurchaseDto })
    @ApiResponse({ 
        status: 201, 
        description: 'Compra one-off creada exitosamente.',
        type: OneOffPurchaseResponseDto
    })
    @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
    @ApiResponse({ status: 404, description: 'Producto o entidad relacionada no encontrada.' })
    @ApiResponse({ status: 409, description: 'Conflicto de stock o restricción única.' })
    createOneOffPurchase(
        @Body(ValidationPipe) createDto: CreateOneOffPurchaseDto
    ): Promise<OneOffPurchaseResponseDto> {
        // Siempre usar la lógica de cliente automático
        return this.multiOneOffPurchaseService.createOneOffWithCustomerLogic(createDto);
    }

    @Get('one-off')
    @ApiOperation({ 
        summary: 'Obtener todas las compras one-off con filtros y paginación',
        description: 'Retorna una lista paginada de compras one-off con opciones de filtrado'
    })
    @ApiQuery({ name: 'search', required: false, description: 'Búsqueda general' })
    @ApiQuery({ name: 'customerName', required: false, description: 'Filtrar por nombre del cliente' })
    @ApiQuery({ name: 'productName', required: false, description: 'Filtrar por descripción del producto' })
    @ApiQuery({ name: 'purchaseDateFrom', required: false, description: 'Filtrar por fecha de compra desde (YYYY-MM-DD)' })
    @ApiQuery({ name: 'purchaseDateTo', required: false, description: 'Filtrar por fecha de compra hasta (YYYY-MM-DD)' })
    @ApiQuery({ name: 'deliveryDateFrom', required: false, description: 'Filtrar por fecha de entrega desde (YYYY-MM-DD)' })
    @ApiQuery({ name: 'deliveryDateTo', required: false, description: 'Filtrar por fecha de entrega hasta (YYYY-MM-DD)' })
    @ApiQuery({ name: 'person_id', required: false, description: 'Filtrar por ID del cliente', type: Number })
    @ApiQuery({ name: 'product_id', required: false, description: 'Filtrar por ID del producto', type: Number })
    @ApiQuery({ name: 'sale_channel_id', required: false, description: 'Filtrar por ID del canal de venta', type: Number })
    @ApiQuery({ name: 'locality_id', required: false, description: 'Filtrar por ID de localidad', type: Number })
    @ApiQuery({ name: 'zone_id', required: false, description: 'Filtrar por ID de zona', type: Number })
    @ApiQuery({ name: 'page', required: false, description: 'Número de página', type: Number })
    @ApiQuery({ name: 'limit', required: false, description: 'Límite de resultados por página', type: Number })
    @ApiQuery({ name: 'sortBy', required: false, description: "Campos para ordenar. Prefijo '-' para descendente.", type: String })
    @ApiResponse({ 
        status: 200, 
        description: 'Lista de compras one-off obtenida exitosamente.',
        schema: {
            properties: {
                data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/OneOffPurchaseResponseDto' }
                },
                meta: {
                    type: 'object',
                    properties: {
                        total: { type: 'number' },
                        page: { type: 'number' },
                        limit: { type: 'number' },
                        totalPages: { type: 'number' }
                    }
                }
            }
        }
    })
    async findAllOneOffPurchases(
        @Query() filterOneOffPurchasesDto: FilterOneOffPurchasesDto
    ): Promise<any> {
        return this.multiOneOffPurchaseService.findAllOneOff(filterOneOffPurchasesDto);
    }

    @Get('one-off/:id')
    @ApiOperation({ 
        summary: 'Obtener una compra one-off por su ID',
        description: 'Retorna los detalles completos de una compra one-off específica'
    })
    @ApiParam({ name: 'id', description: 'ID de la compra one-off', type: Number })
    @ApiResponse({ 
        status: 200, 
        description: 'Compra one-off encontrada exitosamente.',
        type: OneOffPurchaseResponseDto
    })
    @ApiResponse({ status: 404, description: 'Compra one-off no encontrada.' })
    findOneOneOffPurchase(
        @Param('id', ParseIntPipe) id: number
    ): Promise<OneOffPurchaseResponseDto> {
        return this.multiOneOffPurchaseService.findOneOneOff(id);
    }

    @Patch('one-off/:id')
    @ApiOperation({ 
        summary: 'Actualizar una compra one-off por su ID',
        description: 'Actualiza los detalles de una compra one-off existente'
    })
    @ApiParam({ name: 'id', description: 'ID de la compra one-off a actualizar', type: Number })
    @ApiBody({ type: UpdateOneOffPurchaseDto })
    @ApiResponse({ 
        status: 200, 
        description: 'Compra one-off actualizada exitosamente.',
        type: OneOffPurchaseResponseDto
    })
    @ApiResponse({ status: 404, description: 'Compra one-off no encontrada.' })
    @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
    updateOneOffPurchase(
        @Param('id', ParseIntPipe) id: number,
        @Body(ValidationPipe) updateOneOffPurchaseDto: UpdateOneOffPurchaseDto
    ): Promise<OneOffPurchaseResponseDto> {
        return this.multiOneOffPurchaseService.updateOneOff(id, updateOneOffPurchaseDto);
    }

    @Delete('one-off/:id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ 
        summary: 'Eliminar una compra one-off por su ID',
        description: 'Elimina una compra one-off y renueva el stock de productos retornables'
    })
    @ApiParam({ name: 'id', description: 'ID de la compra one-off a eliminar', type: Number })
    @ApiResponse({ 
        status: 200, 
        description: 'Compra one-off eliminada exitosamente.',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Compra One-Off con ID 123 eliminada exitosamente.' },
                deleted: { type: 'boolean', example: true }
            }
        }
    })
    @ApiResponse({ status: 404, description: 'Compra one-off no encontrada.' })
    async removeOneOffPurchase(
        @Param('id', ParseIntPipe) id: number
    ): Promise<{ message: string; deleted: boolean }> {
        return this.multiOneOffPurchaseService.removeOneOff(id);
    }

    @Get(':id')
    @ApiOperation({ 
        summary: '🆕 Obtener una compra múltiple por su ID',
        description: 'Retorna los detalles completos de una compra múltiple específica, incluyendo todos sus productos e información relacionada.'
    })
    @ApiParam({ name: 'id', description: 'ID de la compra múltiple', type: Number })
    @ApiResponse({ 
        status: 200, 
        description: 'Compra múltiple encontrada exitosamente.',
        type: MultiOneOffPurchaseResponseDto
    })
    @ApiResponse({ status: 404, description: 'Compra múltiple no encontrada.' })
    findOneMultiOneOffPurchase(
        @Param('id', ParseIntPipe) id: number
    ): Promise<MultiOneOffPurchaseResponseDto> {
        return this.multiOneOffPurchaseService.findOne(id);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ 
        summary: '🆕 Eliminar una compra múltiple de una vez',
        description: 'Elimina una compra múltiple y renueva el stock de productos retornables. Los productos no retornables mantienen su lógica de devolución existente.'
    })
    @ApiParam({ name: 'id', description: 'ID de la compra múltiple a eliminar', type: Number })
    @ApiResponse({ 
        status: 200, 
        description: 'Compra múltiple eliminada exitosamente. El stock de productos retornables ha sido renovado.',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Compra Múltiple de Una Vez con ID 123 eliminada. El stock de productos retornables ha sido renovado.' },
                deleted: { type: 'boolean', example: true }
            }
        }
    })
    @ApiResponse({ status: 404, description: 'Compra múltiple no encontrada.' })
    @ApiResponse({ status: 409, description: 'No se puede eliminar porque tiene datos relacionados (ej. en hojas de ruta activas).' })
    async removeMultiOneOffPurchase(
        @Param('id', ParseIntPipe) id: number
    ): Promise<{ message: string; deleted: boolean }> {
        return this.multiOneOffPurchaseService.remove(id);
    }
} 