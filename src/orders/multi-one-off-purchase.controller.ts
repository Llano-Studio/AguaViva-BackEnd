import { Controller, Get, Post, Body, Param, Delete, Query, ParseIntPipe, HttpCode, HttpStatus, ValidationPipe, Patch } from '@nestjs/common';
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
        summary: '🆕 Crear una nueva compra de una sola vez con múltiples productos',
        description: `Crea una nueva compra de una sola vez que SOPORTA MÚLTIPLES PRODUCTOS con listas de precios individuales por producto.

## ✅ SOPORTE COMPLETO PARA MÚLTIPLES PRODUCTOS

**Nueva Estructura de Base de Datos:**
- Utiliza \`one_off_purchase_header\` y \`one_off_purchase_item\` 
- Soporte real para múltiples productos por compra
- **🆕 LISTAS DE PRECIOS INDIVIDUALES**: Cada producto puede usar una lista diferente
- Mejor gestión de estados (compra, pago, entrega)
- Historial completo y trazabilidad

## 🆕 LISTAS DE PRECIOS POR PRODUCTO

**Flexibilidad Total:**
- Cada producto en la misma compra puede usar una lista de precios diferente
- Campo \`price_list_id\` opcional a nivel de cada ítem
- Si no se especifica → usa Lista General (ID: ${BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID})
- Precios calculados automáticamente según la lista de cada producto

**Estados Granulares:**
- \`status\`: Estado general de la compra (PENDING, CONFIRMED, CANCELLED)
- \`payment_status\`: Estado del pago (PENDING, PARTIAL, PAID)
- \`delivery_status\`: Estado de entrega (PENDING, IN_TRANSIT, DELIVERED, FAILED)

**Gestión Automática de Stock:**
- Descontado automático para productos no retornables
- Movimientos de inventario registrados para trazabilidad
- Validación de stock disponible antes de confirmar

## Sistema de Precios Avanzado

**Flujo de Precios por Producto Individual:**
1. Si el producto especifica \`price_list_id\` → usar esa lista específica
2. Si no especifica lista → usar Lista General (ID: ${BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID})
3. Si el producto no está en la lista → usar precio base del producto (\`product.price\`)

**Casos de Uso:**
- ✅ Carritos mixtos: algunos productos con descuento corporativo, otros con precio estándar
- ✅ Promociones por producto: productos específicos con listas promocionales
- ✅ Compras B2B complejas: diferentes listas según tipo de producto
- ✅ Trazabilidad completa: qué lista se usó para cada producto`
    })
    @ApiBody({ 
        type: CreateMultiOneOffPurchaseDto,
        examples: {
            compraMixta: {
                summary: '🆕 Compra con listas de precios mixtas',
                description: 'Ejemplo donde cada producto usa una lista de precios diferente',
                value: {
                    person_id: 1,
                    sale_channel_id: 1,
                    items: [
                        { 
                            product_id: 1, 
                            quantity: 2, 
                            price_list_id: 3,  // Lista Corporativa
                            notes: 'Descuento corporativo' 
                        },
                        { 
                            product_id: 3, 
                            quantity: 1, 
                            price_list_id: 5,  // Lista Promocional
                            notes: 'Oferta especial' 
                        },
                        { 
                            product_id: 5, 
                            quantity: 3
                            // Sin price_list_id = Lista General
                        }
                    ],
                    delivery_address: 'Av. Principal 123, Barrio Centro',
                    notes: 'Compra mixta con diferentes descuentos',
                    paid_amount: '150.00'
                }
            },
            compraB2B: {
                summary: 'Compra B2B con listas específicas',
                description: 'Compra empresarial con diferentes listas por tipo de producto',
                value: {
                    person_id: 1,
                    sale_channel_id: 1,
                    items: [
                        { 
                            product_id: 1, 
                            quantity: 10, 
                            price_list_id: 3  // Lista Corporativa Mayorista
                        },
                        { 
                            product_id: 2, 
                            quantity: 5, 
                            price_list_id: 4  // Lista VIP
                        }
                    ],
                    locality_id: 1,
                    zone_id: 2,
                    delivery_address: 'Oficina Central - Piso 5',
                    notes: 'Compra empresarial mensual',
                    status: 'CONFIRMED',
                    payment_status: 'PAID'
                }
            },
            compraPromocion: {
                summary: 'Compra con productos en promoción',
                description: 'Algunos productos con lista promocional, otros normales',
                value: {
                    person_id: 1,
                    sale_channel_id: 1,
                    items: [
                        { 
                            product_id: 1, 
                            quantity: 2, 
                            price_list_id: 6,  // Lista Black Friday
                            notes: 'Promoción Black Friday' 
                        },
                        { 
                            product_id: 3, 
                            quantity: 1
                            // Precio estándar (Lista General)
                        }
                    ],
                    notes: 'Aprovechando promoción especial'
                }
            }
        }
    })
    @ApiResponse({ 
        status: 201, 
        description: 'Compra múltiple creada exitosamente.',
        type: MultiOneOffPurchaseResponseDto
    })
    @ApiResponse({ status: 400, description: 'Datos de entrada inválidos o validaciones fallidas.' })
    @ApiResponse({ status: 404, description: 'Cliente, producto o entidad relacionada no encontrada.' })
    @ApiResponse({ status: 409, description: 'Conflicto de stock o restricción única.' })
    createMultiOneOffPurchase(
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
        summary: 'Crear una nueva compra one-off simple',
        description: 'Crea una nueva compra de una sola vez con un solo producto'
    })
    @ApiBody({ type: CreateOneOffPurchaseDto })
    @ApiResponse({ 
        status: 201, 
        description: 'Compra one-off creada exitosamente.',
        type: OneOffPurchaseResponseDto
    })
    @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
    @ApiResponse({ status: 404, description: 'Cliente, producto o entidad relacionada no encontrada.' })
    createOneOffPurchase(
        @Body(ValidationPipe) createOneOffPurchaseDto: CreateOneOffPurchaseDto
    ): Promise<OneOffPurchaseResponseDto> {
        return this.multiOneOffPurchaseService.createOneOff(createOneOffPurchaseDto);
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