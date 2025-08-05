import { Controller, Get, Post, Body, Param, Delete, Query, ParseIntPipe, HttpCode, HttpStatus, ValidationPipe, Patch } from '@nestjs/common';
import { OneOffPurchaseService } from './one-off-purchase.service';
import { CreateOneOffPurchaseDto } from './dto/create-one-off-purchase.dto';
import { UpdateOneOffPurchaseDto } from './dto/update-one-off-purchase.dto';
import { FilterOneOffPurchasesDto } from './dto/filter-one-off-purchases.dto';
import { OneOffPurchaseResponseDto } from './dto/one-off-purchase-response.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('Compras de Una Vez')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
@Controller('one-off-purchases')
export class OneOffPurchaseController {
    constructor(private readonly oneOffPurchaseService: OneOffPurchaseService) {}





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
        return this.oneOffPurchaseService.createOneOffWithCustomerLogic(createDto);
    }

    @Get('one-off')
    @ApiOperation({ 
        summary: 'Obtener todas las compras one-off',
        description: 'Retorna una lista paginada de compras one-off con opciones de filtrado.'
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
    @ApiQuery({ name: 'page', required: false, description: 'Número de página', type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, description: 'Límite de resultados por página', type: Number, example: 10 })
    @ApiQuery({ name: 'sortBy', required: false, description: 'Ordenamiento (ej: purchase_date:desc)', example: 'purchase_date:desc' })
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
        return this.oneOffPurchaseService.findAllOneOff(filterOneOffPurchasesDto);
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
        return this.oneOffPurchaseService.findOneOneOff(id);
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
        return this.oneOffPurchaseService.updateOneOff(id, updateOneOffPurchaseDto);
    }

    @Delete('one-off/:id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ 
        summary: 'Eliminar una compra one-off por su ID',
        description: 'Elimina una compra one-off y renueva el stock de productos no retornables usando la lógica unificada'
    })
    @ApiParam({ name: 'id', description: 'ID de la compra one-off a eliminar', type: Number })
    @ApiResponse({ 
        status: 200, 
        description: 'Compra one-off eliminada exitosamente.',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Compra One-Off con ID 123 eliminada exitosamente. El stock de productos no retornables ha sido renovado.' },
                deleted: { type: 'boolean', example: true }
            }
        }
    })
    @ApiResponse({ status: 404, description: 'Compra one-off no encontrada.' })
    async removeOneOffPurchase(
        @Param('id', ParseIntPipe) id: number
    ): Promise<{ message: string; deleted: boolean }> {
        return this.oneOffPurchaseService.removeOneOff(id);
    }






}