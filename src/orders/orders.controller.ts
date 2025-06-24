import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, HttpCode, HttpStatus, ValidationPipe } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OneOffPurchaseService } from './one-off-purchase.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { CreateOneOffPurchaseDto } from './dto/create-one-off-purchase.dto';
import { UpdateOneOffPurchaseDto } from './dto/update-one-off-purchase.dto';
import { FilterOneOffPurchasesDto } from './dto/filter-one-off-purchases.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { OrderResponseDto } from './dto/order-response.dto';
import { order_header as OrderHeader, Role } from '@prisma/client';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { OneOffPurchaseResponseDto } from './dto/one-off-purchase-response.dto';
import { ScheduleService } from '../common/services/schedule.service';
import { BUSINESS_CONFIG } from '../common/config/business.config';

@ApiTags('Pedidos & Compras de una sola vez')
@ApiBearerAuth()
@Auth(Role.ADMIN, Role.USER)
@Controller('orders')
export class OrdersController {
    constructor(
        private readonly ordersService: OrdersService,
        private readonly oneOffPurchaseService: OneOffPurchaseService,
        private readonly scheduleService: ScheduleService
    ) { }

    @Post()
    @ApiOperation({ 
        summary: 'Crear un nuevo pedido regular',
        description: `Crea un nuevo pedido regular con sus ítems asociados. Valida el stock disponible y actualiza el inventario.

## Sistema de Precios Diferenciados - CONTRATOS

**Precios para Contratos:**
- Los pedidos con \`contract_id\` usan la lista de precios específica del contrato
- Cada contrato tiene una \`price_list_id\` asignada que define precios personalizados
- Si no se encuentra precio en la lista del contrato, se usa el precio base del producto como fallback
- Flujo: \`contract.price_list_id → price_list_item.unit_price → product.price\` (fallback)

**Casos de Uso:**
- Clientes corporativos con descuentos especiales
- Contratos de largo plazo con precios negociados
- Diferentes tarifas por volumen o tipo de cliente`
    })
    @ApiBody({ type: CreateOrderDto })
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
        description: 'Cliente, producto, contrato o entidad relacionada no encontrada.' 
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
    @ApiQuery({ name: 'search', required: false, description: 'Búsqueda general por cliente, número de pedido, etc.' })
    @ApiQuery({ name: 'customerName', required: false, description: 'Filtrar por nombre del cliente' })
    @ApiQuery({ name: 'orderDateFrom', required: false, description: 'Filtrar por fecha de pedido desde' })
    @ApiQuery({ name: 'orderDateTo', required: false, description: 'Filtrar por fecha de pedido hasta' })
    @ApiQuery({ name: 'status', required: false, description: 'Filtrar por estado del pedido' })
    @ApiQuery({ name: 'orderType', required: false, description: 'Filtrar por tipo de pedido' })
    @ApiQuery({ name: 'customerId', required: false, description: 'Filtrar por ID del cliente' })
    @ApiQuery({ name: 'orderId', required: false, description: 'Filtrar por número/ID de pedido', type: Number })
    @ApiQuery({ name: 'zoneId', required: false, description: 'Filtrar por ID de zona', type: Number })
    @ApiQuery({ name: 'page', required: false, description: 'Número de página', type: Number })
    @ApiQuery({ name: 'limit', required: false, description: 'Límite de resultados por página', type: Number })
    @ApiQuery({ name: 'sortBy', required: false, description: "Campos para ordenar. Prefijo '-' para descendente. Ej: order_date,-customer.name", type: String, example: '-order_date,customer.name' })
    @ApiResponse({ 
        status: 200, 
        description: 'Lista de pedidos obtenida exitosamente.',
        schema: {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/OrderResponseDto' }
                },
                meta: {
                    type: 'object',
                    properties: {
                        total: { type: 'number', example: 100 },
                        page: { type: 'number', example: 1 },
                        limit: { type: 'number', example: 10 },
                        totalPages: { type: 'number', example: 10 }
                    }
                }
            }
        }
    })
    async findAllOrders(
        @Query(ValidationPipe) filterOrdersDto: FilterOrdersDto
    ): Promise<{ data: OrderResponseDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
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
    @ApiBody({ type: UpdateOrderDto })
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
                message: { type: 'string' },
                deleted: { type: 'boolean' }
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
    @ApiOperation({ 
        summary: 'Crear una nueva compra de una sola vez (one-off purchase)',
        description: `Crea una nueva compra de una sola vez con sus ítems asociados. Este tipo de compra es para clientes ocasionales sin contrato fijo.

## Sistema de Precios Diferenciados - COMPRAS ÚNICAS

**Precios para Compras Únicas:**
- Las compras únicas (one-off) usan la Lista de Precios GENERAL/ESTÁNDAR (ID: ${BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID})
- Flujo: \`Lista General (ID: 1) → price_list_item.unit_price → product.price\` (fallback)
- Esta lista permite tener precios diferentes del precio base del producto

**Casos de Uso:**
- Clientes ocasionales sin contrato
- Compras esporádicas
- Precio al público general (puede ser diferente al precio base)`
    })
    @ApiBody({ type: CreateOneOffPurchaseDto })
    @ApiResponse({ 
        status: 201, 
        description: 'Compra de una sola vez creada exitosamente.',
        schema: {
            properties: {
                purchase_id: { type: 'number' },
                person_id: { type: 'number' },
                product_id: { type: 'number' },
                quantity: { type: 'number' },
                sale_channel_id: { type: 'number' },
                locality_id: { type: 'number', nullable: true },
                zone_id: { type: 'number', nullable: true },
                purchase_date: { type: 'string', format: 'date-time' },
                total_amount: { type: 'string' },
                payment_status: { type: 'string', nullable: true, enum: ['PENDING', 'PAID', 'PARTIAL'] },
                delivery_status: { type: 'string', nullable: true, enum: ['PENDING', 'COMPLETED', 'CANCELLED'] },
                notes: { type: 'string', nullable: true },
                payment_method_id: { type: 'number', nullable: true },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
                person: {
                    type: 'object',
                    properties: {
                        person_id: { type: 'number' },
                        name: { type: 'string' },
                        tax_id: { type: 'string', nullable: true },
                        address: { type: 'string', nullable: true }
                    }
                },
                product: {
                    type: 'object',
                    properties: {
                        product_id: { type: 'number' },
                        description: { type: 'string' },
                        code: { type: 'string', nullable: true },
                        price: { type: 'string' }
                    }
                },
                sale_channel: {
                    type: 'object',
                    properties: {
                        sale_channel_id: { type: 'number' },
                        name: { type: 'string' }
                    }
                },
                locality: {
                    type: 'object',
                    nullable: true,
                    properties: {
                        locality_id: { type: 'number' },
                        name: { type: 'string' }
                    }
                },
                zone: {
                    type: 'object',
                    nullable: true,
                    properties: {
                        zone_id: { type: 'number' },
                        name: { type: 'string' }
                    }
                }
            }
        }
    })
    @ApiResponse({ status: 400, description: 'Datos de entrada inválidos o validaciones fallidas.' })
    @ApiResponse({ status: 404, description: 'Cliente, producto o entidad relacionada no encontrada.' })
    @ApiResponse({ status: 409, description: 'Conflicto de stock o restricción única.' })
    createOneOffPurchase(
        @Body(ValidationPipe) createOneOffPurchaseDto: CreateOneOffPurchaseDto
    ): Promise<OneOffPurchaseResponseDto> {
        return this.oneOffPurchaseService.create(createOneOffPurchaseDto);
    }

    @Get('one-off')
    @ApiOperation({ 
        summary: 'Obtener todas las compras de una sola vez (one-off purchases)',
        description: 'Retorna una lista paginada de compras de una sola vez con opciones de filtrado.'
    })
    @ApiQuery({ name: 'customerName', required: false, description: 'Filtrar por nombre del cliente' })
    @ApiQuery({ name: 'purchaseDateFrom', required: false, description: 'Filtrar por fecha de compra desde' })
    @ApiQuery({ name: 'purchaseDateTo', required: false, description: 'Filtrar por fecha de compra hasta' })
    @ApiQuery({ name: 'status', required: false, description: 'Filtrar por estado de la compra (delivery_status)', enum: ['PENDING', 'COMPLETED', 'CANCELLED'] })
    @ApiQuery({ name: 'paymentStatus', required: false, description: 'Filtrar por estado de pago', enum: ['PENDING', 'PAID', 'PARTIAL'] })
    @ApiQuery({ name: 'customerId', required: false, description: 'Filtrar por ID del cliente (person_id)' })
    @ApiQuery({ name: 'page', required: false, description: 'Número de página', type: Number })
    @ApiQuery({ name: 'limit', required: false, description: 'Límite de resultados por página', type: Number })
    @ApiQuery({ name: 'sortBy', required: false, description: "Campos para ordenar. Prefijo '-' para descendente. Ej: -purchase_date,person.name", type: String, example: '-purchase_date,person.name' })
    @ApiResponse({ 
        status: 200, 
        description: 'Lista de compras de una sola vez obtenida exitosamente.',
        schema: {
            properties: {
                data: {
                    type: 'array',
                    items: {
                        type: 'object', 
                        properties: {
                           purchase_id: { type: 'number' },
                           person_id: { type: 'number' },
                           product_id: { type: 'number' },
                           quantity: { type: 'number' },
                           sale_channel_id: { type: 'number' },
                           locality_id: { type: 'number', nullable: true },
                           zone_id: { type: 'number', nullable: true },
                           purchase_date: { type: 'string', format: 'date-time' },
                           total_amount: { type: 'string' },
                           payment_status: { type: 'string', nullable: true, enum: ['PENDING', 'PAID', 'PARTIAL'] },
                           delivery_status: { type: 'string', nullable: true, enum: ['PENDING', 'COMPLETED', 'CANCELLED'] },
                           notes: { type: 'string', nullable: true },
                           payment_method_id: { type: 'number', nullable: true },
                           created_at: { type: 'string', format: 'date-time' },
                           updated_at: { type: 'string', format: 'date-time' },
                           person: {
                               type: 'object',
                               properties: {
                                   person_id: { type: 'number' },
                                   name: { type: 'string' }
                               }
                           },
                           product: {
                               type: 'object',
                               properties: {
                                   product_id: { type: 'number' },
                                   description: { type: 'string' }
                               }
                           }
                        }
                    }
                },
                meta: {
                    type: 'object',
                    properties: {
                        total: { type: 'number' },
                        page: { type: 'number' },
                        limit: { type: 'number' }
                    }
                }
            }
        }
    })
    async findAllOneOffPurchases(
        @Query(ValidationPipe) filterOneOffPurchasesDto: FilterOneOffPurchasesDto
    ): Promise<{ data: OneOffPurchaseResponseDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
        return this.oneOffPurchaseService.findAll(filterOneOffPurchasesDto);
    }

    @Get('one-off/:id')
    @ApiOperation({ 
        summary: 'Obtener una compra de una sola vez (one-off purchase) por su ID',
        description: 'Retorna los detalles completos de una compra de una sola vez específica, incluyendo sus ítems.'
    })
    @ApiParam({ name: 'id', description: 'ID de la compra de una sola vez', type: Number })
    @ApiResponse({ 
        status: 200, 
        description: 'Compra de una sola vez encontrada exitosamente.',
        schema: {
            properties: {
                purchase_id: { type: 'number' },
                person_id: { type: 'number' },
                product_id: { type: 'number' },
                quantity: { type: 'number' },
                sale_channel_id: { type: 'number' },
                locality_id: { type: 'number', nullable: true },
                zone_id: { type: 'number', nullable: true },
                purchase_date: { type: 'string', format: 'date-time' },
                total_amount: { type: 'string' },
                payment_status: { type: 'string', nullable: true, enum: ['PENDING', 'PAID', 'PARTIAL'] },
                delivery_status: { type: 'string', nullable: true, enum: ['PENDING', 'COMPLETED', 'CANCELLED'] },
                notes: { type: 'string', nullable: true },
                payment_method_id: { type: 'number', nullable: true },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
                person: {
                    type: 'object',
                    properties: {
                        person_id: { type: 'number' },
                        name: { type: 'string' },
                        tax_id: { type: 'string', nullable: true },
                        address: { type: 'string', nullable: true }
                    }
                },
                product: {
                    type: 'object',
                    properties: {
                        product_id: { type: 'number' },
                        description: { type: 'string' },
                        code: { type: 'string', nullable: true},
                        price: { type: 'string' }
                    }
                },
                sale_channel: {
                    type: 'object',
                    properties: {
                        sale_channel_id: { type: 'number' },
                        name: { type: 'string' }
                    }
                },
                locality: {
                    type: 'object',
                    nullable: true,
                    properties: {
                        locality_id: { type: 'number' },
                        name: { type: 'string' }
                    }
                },
                zone: {
                    type: 'object',
                    nullable: true,
                    properties: {
                        zone_id: { type: 'number' },
                        name: { type: 'string' }
                    }
                }
            }
        }
    })
    @ApiResponse({ status: 404, description: 'Compra de una sola vez no encontrada.' })
    findOneOneOffPurchase(
        @Param('id', ParseIntPipe) id: number
    ): Promise<OneOffPurchaseResponseDto> {
        return this.oneOffPurchaseService.findOne(id);
    }

    @Patch('one-off/:id')
    @ApiOperation({ 
        summary: 'Actualizar una compra de una sola vez (one-off purchase) por su ID',
        description: 'Actualiza los detalles de una compra de una sola vez existente, incluyendo sus ítems si se proporcionan.'
    })
    @ApiParam({ name: 'id', description: 'ID de la compra de una sola vez', type: Number })
    @ApiBody({ type: UpdateOneOffPurchaseDto })
    @ApiResponse({ 
        status: 200, 
        description: 'Compra de una sola vez actualizada exitosamente.',
        schema: {
            properties: {
                purchase_id: { type: 'number' },
                person_id: { type: 'number' },
                product_id: { type: 'number' },
                quantity: { type: 'number' },
                sale_channel_id: { type: 'number' },
                locality_id: { type: 'number', nullable: true },
                zone_id: { type: 'number', nullable: true },
                purchase_date: { type: 'string', format: 'date-time' },
                total_amount: { type: 'string' },
                payment_status: { type: 'string', nullable: true, enum: ['PENDING', 'PAID', 'PARTIAL'] },
                delivery_status: { type: 'string', nullable: true, enum: ['PENDING', 'COMPLETED', 'CANCELLED'] },
                notes: { type: 'string', nullable: true },
                payment_method_id: { type: 'number', nullable: true },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
                person: {
                    type: 'object',
                    properties: {
                        person_id: { type: 'number' },
                        name: { type: 'string' },
                        tax_id: { type: 'string', nullable: true },
                        address: { type: 'string', nullable: true }
                    }
                },
                product: {
                    type: 'object',
                    properties: {
                        product_id: { type: 'number' },
                        description: { type: 'string' },
                        code: { type: 'string', nullable: true},
                        price: { type: 'string' }
                    }
                },
                sale_channel: {
                    type: 'object',
                    properties: {
                        sale_channel_id: { type: 'number' },
                        name: { type: 'string' }
                    }
                },
                locality: {
                    type: 'object',
                    nullable: true,
                    properties: {
                        locality_id: { type: 'number' },
                        name: { type: 'string' }
                    }
                },
                zone: {
                    type: 'object',
                    nullable: true,
                    properties: {
                        zone_id: { type: 'number' },
                        name: { type: 'string' }
                    }
                }
            }
        }
    })
    @ApiResponse({ status: 404, description: 'Compra de una sola vez no encontrada.' })
    @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
    @ApiResponse({ status: 409, description: 'Conflicto al actualizar (ej. estado no permitido).' })
    updateOneOffPurchase(
        @Param('id', ParseIntPipe) id: number,
        @Body(ValidationPipe) updateOneOffPurchaseDto: UpdateOneOffPurchaseDto
    ): Promise<OneOffPurchaseResponseDto> {
        return this.oneOffPurchaseService.update(id, updateOneOffPurchaseDto);
    }

    @Delete('one-off/:id')
    @ApiOperation({ 
        summary: 'Eliminar una compra de una sola vez (one-off purchase) por su ID',
        description: 'Elimina una compra de una sola vez y sus ítems asociados. Solo permite eliminar compras en estado PENDING.'
    })
    @ApiParam({ name: 'id', description: 'ID de la compra de una sola vez', type: Number })
    @ApiResponse({ 
        status: 200, 
        description: 'Compra de una sola vez eliminada exitosamente.',
        schema: {
            properties: {
                message: { type: 'string' },
                deleted: { type: 'boolean' }
            }
        }
    })
    @ApiResponse({ status: 404, description: 'Compra de una sola vez no encontrada.' })
    @ApiResponse({ status: 409, description: 'No se puede eliminar una compra que no está en estado PENDING.' })
    removeOneOffPurchase(
        @Param('id', ParseIntPipe) id: number
    ): Promise<{ message: string; deleted: boolean }> {
        return this.oneOffPurchaseService.remove(id);
    }

    /**
     * Obtener horarios disponibles para entrega
     */
    @Get('available-time-slots')
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
                            label: { type: 'string', example: '08:00-10:00' }
                        }
                    }
                },
                workingDays: {
                    type: 'array',
                    items: { type: 'number' },
                    example: [1, 2, 3, 4, 5, 6]
                }
            }
        }
    })
    getAvailableTimeSlots() {
        return {
            timeSlots: this.scheduleService.getAvailableTimeSlots(),
            workingDays: BUSINESS_CONFIG.DELIVERY_SCHEDULE.WORKING_DAYS
        };
    }

    /**
     * Validar horario de entrega
     */
    @Post('validate-schedule')
    @ApiOperation({ summary: 'Validar horario de entrega' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                orderDate: { type: 'string', format: 'date-time', example: '2024-01-15T10:00:00.000Z' },
                scheduledDeliveryDate: { type: 'string', format: 'date-time', example: '2024-01-16T14:00:00.000Z' },
                deliveryTime: { type: 'string', example: '14:00-16:00' }
            },
            required: ['orderDate', 'scheduledDeliveryDate']
        }
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
                suggestedTimeSlot: { type: 'string' }
            }
        }
    })
    validateSchedule(
        @Body() body: {
            orderDate: string;
            scheduledDeliveryDate: string;
            deliveryTime?: string;
        }
    ) {
        return this.scheduleService.validateOrderSchedule(
            new Date(body.orderDate),
            new Date(body.scheduledDeliveryDate),
            body.deliveryTime
        );
    }
}
