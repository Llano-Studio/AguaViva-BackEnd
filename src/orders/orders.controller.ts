import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, HttpCode, HttpStatus, ValidationPipe } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OneOffPurchaseService } from './one-off-purchase.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { CreateOneOffPurchaseDto } from './dto/create-one-off-purchase.dto';
import { UpdateOneOffPurchaseDto } from './dto/update-one-off-purchase.dto';
import { FilterOneOffPurchasesDto } from './dto/filter-one-off-purchases.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { OrderResponseDto } from './dto/order-response.dto';
import { order_header as OrderHeader, Role } from '@prisma/client';
import { Auth } from 'src/auth/decorators/auth.decorator';

@ApiTags('Pedidos & Compras de una sola vez')
@ApiBearerAuth()
@Auth(Role.ADMIN, Role.USER)
@Controller('orders')
export class OrdersController {
    constructor(
        private readonly ordersService: OrdersService,
        private readonly oneOffPurchaseService: OneOffPurchaseService,
    ) { }

    @Post()
    @ApiOperation({ 
        summary: 'Crear un nuevo pedido regular',
        description: 'Crea un nuevo pedido regular con sus ítems asociados. Valida el stock disponible y actualiza el inventario.'
    })
    @ApiResponse({ 
        status: 201, 
        description: 'Pedido creado exitosamente.',
        type: OrderResponseDto
    })
    @ApiResponse({ 
        status: 400, 
        description: 'Datos de entrada inválidos o validaciones fallidas.' 
    })
    @ApiResponse({ 
        status: 404, 
        description: 'Cliente, producto o entidad relacionada no encontrada.' 
    })
    @ApiResponse({ 
        status: 409, 
        description: 'Conflicto de stock o restricción única.' 
    })
    async createOrder(
        @Body(ValidationPipe) createOrderDto: CreateOrderDto
    ): Promise<OrderResponseDto> {
        return this.ordersService.create(createOrderDto);
    }

    @Get()
    @ApiOperation({ 
        summary: 'Obtener todos los pedidos regulares',
        description: 'Retorna una lista paginada de pedidos regulares con opciones de filtrado.'
    })
    @ApiQuery({ name: 'customerName', required: false, description: 'Filtrar por nombre del cliente' })
    @ApiQuery({ name: 'orderDateFrom', required: false, description: 'Filtrar por fecha de pedido desde' })
    @ApiQuery({ name: 'orderDateTo', required: false, description: 'Filtrar por fecha de pedido hasta' })
    @ApiQuery({ name: 'status', required: false, description: 'Filtrar por estado del pedido' })
    @ApiQuery({ name: 'orderType', required: false, description: 'Filtrar por tipo de pedido' })
    @ApiQuery({ name: 'customerId', required: false, description: 'Filtrar por ID del cliente' })
    @ApiQuery({ name: 'page', required: false, description: 'Número de página' })
    @ApiQuery({ name: 'limit', required: false, description: 'Límite de resultados por página' })
    @ApiResponse({ 
        status: 200, 
        description: 'Lista de pedidos obtenida exitosamente.',
        type: [OrderResponseDto]
    })
    async findAllOrders(
        @Query(ValidationPipe) filterOrdersDto: FilterOrdersDto
    ): Promise<OrderResponseDto[]> {
        return this.ordersService.findAll(filterOrdersDto);
    }

    @Get(':id')
    @ApiOperation({ 
        summary: 'Obtener un pedido regular por ID',
        description: 'Retorna los detalles completos de un pedido regular específico.'
    })
    @ApiParam({ name: 'id', description: 'ID del pedido' })
    @ApiResponse({ 
        status: 200, 
        description: 'Pedido encontrado exitosamente.',
        type: OrderResponseDto
    })
    @ApiResponse({ 
        status: 404, 
        description: 'Pedido no encontrado.' 
    })
    async findOneOrder(
        @Param('id', ParseIntPipe) id: number
    ): Promise<OrderResponseDto> {
        return this.ordersService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ 
        summary: 'Actualizar un pedido regular',
        description: 'Actualiza los detalles de un pedido regular existente, incluyendo sus ítems.'
    })
    @ApiParam({ name: 'id', description: 'ID del pedido' })
    @ApiResponse({ 
        status: 200, 
        description: 'Pedido actualizado exitosamente.',
        type: OrderResponseDto
    })
    @ApiResponse({ 
        status: 400, 
        description: 'Datos de entrada inválidos.' 
    })
    @ApiResponse({ 
        status: 404, 
        description: 'Pedido o entidad relacionada no encontrada.' 
    })
    @ApiResponse({ 
        status: 409, 
        description: 'Conflicto de stock o restricción única.' 
    })
    async updateOrder(
        @Param('id', ParseIntPipe) id: number,
        @Body(ValidationPipe) updateOrderDto: UpdateOrderDto
    ): Promise<OrderResponseDto> {
        return this.ordersService.update(id, updateOrderDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ 
        summary: 'Eliminar un pedido regular',
        description: 'Elimina un pedido regular y sus ítems asociados. Solo permite eliminar pedidos en estado PENDING.'
    })
    @ApiParam({ name: 'id', description: 'ID del pedido' })
    @ApiResponse({ 
        status: 200, 
        description: 'Pedido eliminado exitosamente.',
        schema: { 
            type: 'object', 
            properties: { 
                message: { type: 'string' } 
            } 
        }
    })
    @ApiResponse({ 
        status: 404, 
        description: 'Pedido no encontrado.' 
    })
    @ApiResponse({ 
        status: 409, 
        description: 'No se puede eliminar un pedido que no está en estado PENDING.' 
    })
    async removeOrder(
        @Param('id', ParseIntPipe) id: number
    ): Promise<{ message: string }> {
        return this.ordersService.remove(id);
    }

    @Post('one-off')
    @ApiOperation({ summary: 'Crear una nueva compra de una sola vez (one-off purchase)' })
    @ApiResponse({ status: 201, description: 'Compra de una sola vez creada exitosamente.' })
    @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
    @ApiResponse({ status: 404, description: 'Alguna entidad relacionada no fue encontrada.' })
    createOneOffPurchase(
        @Body() createOneOffPurchaseDto: CreateOneOffPurchaseDto
    ) {
        return this.oneOffPurchaseService.create(createOneOffPurchaseDto);
    }

    @Get('one-off')
    @ApiOperation({ summary: 'Obtener todas las compras de una sola vez (one-off purchases)' })
    @ApiResponse({ status: 200, description: 'Compras de una sola vez obtenidas exitosamente.' })
    findAllOneOffPurchases(
        @Query() filterOneOffPurchasesDto: FilterOneOffPurchasesDto
    ) {
        return this.oneOffPurchaseService.findAll(filterOneOffPurchasesDto);
    }

    @Get('one-off/:id')
    @ApiOperation({ summary: 'Obtener una compra de una sola vez (one-off purchase) por su ID' })
    @ApiResponse({ status: 200, description: 'Compra de una sola vez encontrada.' })
    @ApiResponse({ status: 404, description: 'Compra de una sola vez no encontrada.' })
    findOneOneOffPurchase(
        @Param('id', ParseIntPipe) id: number
    ) {
        return this.oneOffPurchaseService.findOne(id);
    }

    @Patch('one-off/:id')
    @ApiOperation({ summary: 'Actualizar una compra de una sola vez (one-off purchase) por su ID' })
    @ApiResponse({ status: 200, description: 'Compra de una sola vez actualizada exitosamente.' })
    @ApiResponse({ status: 404, description: 'Compra de una sola vez no encontrada.' })
    @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
    updateOneOffPurchase(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateOneOffPurchaseDto: UpdateOneOffPurchaseDto
    ) {
        return this.oneOffPurchaseService.update(id, updateOneOffPurchaseDto);
    }

    @Delete('one-off/:id')
    @ApiOperation({ summary: 'Eliminar una compra de una sola vez (one-off purchase) por su ID' })
    @ApiResponse({ status: 200, description: 'Compra de una sola vez eliminada exitosamente.' })
    @ApiResponse({ status: 404, description: 'Compra de una sola vez no encontrada.' })
    removeOneOffPurchase(
        @Param('id', ParseIntPipe) id: number
    ) {
        return this.oneOffPurchaseService.remove(id);
    }
}
