import { Injectable, NotFoundException, OnModuleInit, InternalServerErrorException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma, order_header as PrismaOrderHeader, order_item as PrismaOrderItem, OrderStatus as PrismaOrderStatus, OrderType as PrismaOrderType, product as PrismaProduct, person as PrismaPerson, sale_channel as PrismaSaleChannel, client_contract as PrismaClientContract } from '@prisma/client';
import { CreateOrderDto, CreateOrderItemDto } from './dto/create-order.dto';
import { UpdateOrderDto, UpdateOrderItemDto } from './dto/update-order.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { InventoryService } from '../inventory/inventory.service';
import { ScheduleService } from '../common/services/schedule.service';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderResponseDto, OrderItemResponseDto } from './dto/order-response.dto';
import { OrderStatus as AppOrderStatus, OrderType as AppOrderType } from '../common/constants/enums';
import { CreateStockMovementDto } from '../inventory/dto/create-stock-movement.dto';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';
import { BUSINESS_CONFIG } from '../common/config/business.config';

// Definición del tipo para el payload del customer con sus relaciones anidadas
type CustomerPayload = Prisma.personGetPayload<{
    include: { 
        locality: { include: { zones: true } }, 
        zone: true 
    }
}> | null | undefined;

// Definición del tipo para el payload del sale_channel
type SaleChannelPayload = Prisma.sale_channelGetPayload<{}> | null | undefined;

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
    private readonly entityName = 'Pedido';

    constructor(private readonly inventoryService: InventoryService, private readonly scheduleService: ScheduleService) { 
        super(); 
    }

    async onModuleInit() {
        await this.$connect();
    }

    private mapToOrderResponseDto(order: Prisma.order_headerGetPayload<{ 
        include: { 
            order_item: { include: { product: true } }, 
            customer: { include: { locality: { include: { zones: true } }, zone: true } }, 
            sale_channel: true, 
            customer_subscription: true, 
            client_contract: true 
        }
    }>): OrderResponseDto {
        
        const customerPayload: CustomerPayload = order.customer;
        const saleChannelPayload: SaleChannelPayload = order.sale_channel;

        let customerResponsePart: any = { person_id: 0, name: '', phone: '' };
        if (customerPayload) {
            customerResponsePart = {
                person_id: customerPayload.person_id,
                name: customerPayload.name || '',
                phone: customerPayload.phone,
                locality: customerPayload.locality ? {
                    locality_id: customerPayload.locality.locality_id,
                    name: customerPayload.locality.name || '',
                    zones: customerPayload.locality.zones?.map(zone => ({
                        zone_id: zone.zone_id,
                        name: zone.name || ''
                    })) || []
                } : undefined,
                zone: customerPayload.zone ? {
                    zone_id: customerPayload.zone.zone_id,
                    name: customerPayload.zone.name || ''
                } : undefined
            };
        }

        let saleChannelResponsePart: any = { sale_channel_id: 0, name: '' };
        if (saleChannelPayload) {
            saleChannelResponsePart = {
                sale_channel_id: saleChannelPayload.sale_channel_id,
                name: saleChannelPayload.description || ''
            };
        }

        return {
            order_id: order.order_id,
            customer_id: order.customer_id,
            contract_id: order.contract_id ?? undefined,
            subscription_id: order.subscription_id ?? undefined,
            sale_channel_id: order.sale_channel_id,
            order_date: order.order_date.toISOString(),
            scheduled_delivery_date: order.scheduled_delivery_date ? order.scheduled_delivery_date.toISOString() : undefined,
            delivery_time: order.delivery_time ?? undefined,
            total_amount: order.total_amount.toString(),
            paid_amount: order.paid_amount.toString(),
            order_type: order.order_type as unknown as AppOrderType,
            status: order.status as unknown as AppOrderStatus,
            notes: order.notes ?? undefined,
            order_item: order.order_item?.map(item => ({
                order_item_id: item.order_item_id,
                product_id: item.product_id,
                quantity: item.quantity,
                subtotal: item.subtotal.toString(),
                total_amount: item.total_amount.toString(),
                amount_paid: item.amount_paid.toString(),
                product: {
                    product_id: item.product.product_id,
                    description: item.product.description,
                    price: item.product.price.toString()
                }
            } as OrderItemResponseDto)) || [],
            customer: customerResponsePart,
            sale_channel: saleChannelResponsePart,
        };
    }

    private async validateOrderData(createOrderDto: CreateOrderDto, tx: Prisma.TransactionClient) {
        const prisma = tx || this;
        const customer = await prisma.person.findUnique({ where: { person_id: createOrderDto.customer_id } });
        if (!customer) throw new NotFoundException(`Cliente con ID ${createOrderDto.customer_id} no encontrado.`);

        const saleChannel = await prisma.sale_channel.findUnique({ where: { sale_channel_id: createOrderDto.sale_channel_id } });
        if (!saleChannel) throw new NotFoundException(`Canal de venta con ID ${createOrderDto.sale_channel_id} no encontrado.`);

        if (createOrderDto.contract_id) {
            const contract = await prisma.client_contract.findUnique({ where: { contract_id: createOrderDto.contract_id } });
            if (!contract) throw new NotFoundException(`Contrato con ID ${createOrderDto.contract_id} no encontrado.`);
            if (contract.person_id !== createOrderDto.customer_id) throw new BadRequestException('El contrato no pertenece al cliente especificado.');
        }

        if (createOrderDto.subscription_id) {
            const subscription = await prisma.customer_subscription.findUnique({ where: { subscription_id: createOrderDto.subscription_id } });
            if (!subscription) throw new NotFoundException(`Suscripción con ID ${createOrderDto.subscription_id} no encontrada.`);
            if (subscription.customer_id !== createOrderDto.customer_id) throw new BadRequestException('La suscripción no pertenece al cliente especificado.');
        }

        const totalAmount = new Decimal(createOrderDto.total_amount);
        const paidAmount = new Decimal(createOrderDto.paid_amount);
        if (paidAmount.greaterThan(totalAmount)) throw new BadRequestException('El monto pagado no puede ser mayor al monto total del pedido.');

        if (createOrderDto.scheduled_delivery_date) {
            const orderDate = new Date(createOrderDto.order_date);
            const deliveryDate = new Date(createOrderDto.scheduled_delivery_date);
            if (deliveryDate <= orderDate) throw new BadRequestException('La fecha de entrega programada debe ser posterior a la fecha del pedido.');
        }

        // Validar horario
        if (createOrderDto.scheduled_delivery_date) {
            const orderDate = new Date(createOrderDto.order_date);
            const deliveryDate = new Date(createOrderDto.scheduled_delivery_date);
            
            const scheduleResult = this.scheduleService.validateOrderSchedule(
                orderDate, 
                deliveryDate, 
                createOrderDto.delivery_time
            );
            
            if (!scheduleResult.isValid) {
                throw new BadRequestException(scheduleResult.message);
            }
        }
    }

    async create(createOrderDto: CreateOrderDto): Promise<OrderResponseDto> {
        try {
            return await this.$transaction(async (prismaTx) => {
                await this.validateOrderData(createOrderDto, prismaTx);

                const { customer_id, sale_channel_id, items, subscription_id, contract_id, total_amount: dtoTotalAmountStr, paid_amount: dtoPaidAmountStr, ...restOfDto } = createOrderDto;

                let calculatedTotalFromDB = new Decimal(0);
                const orderItemsDataForCreation: Prisma.order_itemUncheckedCreateWithoutOrder_headerInput[] = [];

                // Si hay contrato, obtener la lista de precios del contrato
                let contractPriceList: { price_list_item: { product_id: number; price_list_item_id: number; unit_price: any }[] } | null = null;
                if (contract_id) {
                    const contract = await prismaTx.client_contract.findUnique({
                        where: { contract_id },
                        include: {
                            price_list: {
                                include: {
                                    price_list_item: true
                                }
                            }
                        }
                    });
                    
                    if (!contract) {
                        throw new NotFoundException(`Contrato con ID ${contract_id} no encontrado.`);
                    }
                    
                    contractPriceList = contract.price_list;
                }

                // Si hay suscripción, obtener el plan con sus productos
                let subscriptionPlan: { subscription_plan_product: { product_id: number; product_quantity: number }[]; price?: any } | null = null;
                if (subscription_id) {
                    const subscription = await prismaTx.customer_subscription.findUnique({
                        where: { subscription_id },
                        include: {
                            subscription_plan: {
                                include: {
                                    subscription_plan_product: true
                                }
                            }
                        }
                    });
                    
                    if (!subscription) {
                        throw new NotFoundException(`Suscripción con ID ${subscription_id} no encontrada.`);
                    }
                    
                    subscriptionPlan = subscription.subscription_plan;
                }

                for (const itemDto of items) {
                    const productDetails = await prismaTx.product.findUniqueOrThrow({
                        where: { product_id: itemDto.product_id },
                    }).catch(() => { throw new NotFoundException(`Producto con ID ${itemDto.product_id} no encontrado.`); });
                    
                    let itemPrice = new Decimal(productDetails.price); // Precio base por defecto

                    // Lógica de precios por prioridad: Contrato > Suscripción específica > Precio base
                    if (contractPriceList) {
                        // Cliente con contrato → usar lista de precios del contrato
                        const priceListItem = contractPriceList.price_list_item.find(
                            item => item.product_id === itemDto.product_id
                        );
                        
                        if (priceListItem) {
                            itemPrice = new Decimal(priceListItem.unit_price);
                        } else {
                            // Producto no está en la lista de precios del contrato
                            throw new BadRequestException(
                                `El producto ${productDetails.description} (ID: ${itemDto.product_id}) no está disponible en la lista de precios del contrato. Verifique la lista de precios asociada al contrato.`
                            );
                        }
                    } else if (subscriptionPlan) {
                        // Cliente con suscripción → usar precio del plan (paquete cerrado)
                        const planProduct = subscriptionPlan.subscription_plan_product.find(
                            spp => spp.product_id === itemDto.product_id
                        );
                        
                        if (!planProduct) {
                            throw new BadRequestException(
                                `El producto ${productDetails.description} (ID: ${itemDto.product_id}) no está incluido en el plan de suscripción.`
                            );
                        }
                        
                        // Para suscripciones, usar precio proporcional del plan si está definido
                        if (subscriptionPlan.price) {
                            const totalProductsInPlan = subscriptionPlan.subscription_plan_product.reduce((sum, spp) => sum + spp.product_quantity, 0);
                            const productProportion = planProduct.product_quantity / totalProductsInPlan;
                            itemPrice = new Decimal(subscriptionPlan.price).mul(productProportion).div(planProduct.product_quantity);
                        } else {
                            // Si el plan no tiene precio definido, usar precio base del producto
                            itemPrice = new Decimal(productDetails.price);
                        }
                    } else {
                        // Si no hay contrato ni suscripción → usar lista de precios estándar
                        const standardPriceItem = await prismaTx.price_list_item.findFirst({
                            where: { 
                                price_list_id: BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID,
                                product_id: itemDto.product_id 
                            }
                        });
                        
                        if (standardPriceItem) {
                            itemPrice = new Decimal(standardPriceItem.unit_price);
                        }
                                                 // Si no está en lista estándar, mantener precio base como fallback
                    }
                    
                    const itemSubtotal = itemPrice.mul(itemDto.quantity);
                    calculatedTotalFromDB = calculatedTotalFromDB.plus(itemSubtotal);
                    orderItemsDataForCreation.push({
                        product_id: itemDto.product_id,
                        quantity: itemDto.quantity,
                        subtotal: itemSubtotal.toString(),
                        total_amount: itemSubtotal.toString(),
                        amount_paid: '0.00',
                    });
                }

                const finalPaidAmount = new Decimal(dtoPaidAmountStr || '0');
                if (finalPaidAmount.greaterThan(calculatedTotalFromDB)) {
                    throw new BadRequestException('El monto pagado no puede ser mayor al monto total del pedido calculado.');
                }
                if (dtoTotalAmountStr && !new Decimal(dtoTotalAmountStr).equals(calculatedTotalFromDB)) {
                    throw new BadRequestException(
                        `El total_amount enviado (${dtoTotalAmountStr}) no coincide con el calculado desde la base de datos (${calculatedTotalFromDB.toString()}). Verifique los precios y cantidades.`
                    );
                }

                const saleMovementTypeId = await this.inventoryService.getMovementTypeIdByCode(
                    BUSINESS_CONFIG.MOVEMENT_TYPES.EGRESO_VENTA_PRODUCTO,
                    prismaTx,
                );

                for (const itemDto of items) {
                    const productDetails = await prismaTx.product.findUniqueOrThrow({ where: { product_id: itemDto.product_id } });
                    const stockDisponible = await this.inventoryService.getProductStock(
                        itemDto.product_id,
                        BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                        prismaTx,
                    );
                    if (stockDisponible < itemDto.quantity && !productDetails.is_returnable) {
                        throw new BadRequestException(
                            `${this.entityName}: Stock insuficiente para el producto ${productDetails.description} (ID: ${itemDto.product_id}). Disponible: ${stockDisponible}, Solicitado: ${itemDto.quantity}.`,
                        );
                    }
                }

                const newOrderHeader = await prismaTx.order_header.create({
                    data: {
                        ...restOfDto,
                        order_date: restOfDto.order_date ? new Date(restOfDto.order_date) : new Date(),
                        scheduled_delivery_date: restOfDto.scheduled_delivery_date ? new Date(restOfDto.scheduled_delivery_date) : undefined,
                        total_amount: calculatedTotalFromDB.toString(),
                        paid_amount: finalPaidAmount.toString(),
                        status: (restOfDto.status as PrismaOrderStatus) || PrismaOrderStatus.PENDING,
                        customer: { connect: { person_id: customer_id } },
                        sale_channel: { connect: { sale_channel_id: sale_channel_id } },
                        order_type: restOfDto.order_type as PrismaOrderType,
                        ...(subscription_id && { customer_subscription: { connect: { subscription_id } } }),
                        ...(contract_id && { client_contract: { connect: { contract_id } } }),
                        order_item: {
                            createMany: {
                                data: orderItemsDataForCreation,
                            }
                        },
                    },
                    include: {
                        order_item: { include: { product: true } },
                        customer: { include: { locality: { include: { zones: true } }, zone: true } }, 
                        sale_channel: true,
                        customer_subscription: true,
                        client_contract: true
                    },
                });

                for (const createdItem of newOrderHeader.order_item) {
                    const productDesc = createdItem.product ? createdItem.product.description : 'N/A';
                    const stockMovementDto: CreateStockMovementDto = {
                        movement_type_id: saleMovementTypeId,
                        product_id: createdItem.product_id,
                        quantity: createdItem.quantity,
                        source_warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                        destination_warehouse_id: null,
                        movement_date: new Date(), 
                        remarks: `${this.entityName} #${newOrderHeader.order_id} - Producto ${productDesc} (ID ${createdItem.product_id})`,
                    };
                    await this.inventoryService.createStockMovement(stockMovementDto, prismaTx);
                }
                
                return this.mapToOrderResponseDto(newOrderHeader);
            });
        } catch (error) {
            handlePrismaError(error, this.entityName);
            if (!(error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException || error instanceof InternalServerErrorException)) {
                 throw new InternalServerErrorException('Error no manejado después de handlePrismaError en create order.');
            }
            throw error;
        }
    }

    async findAll(filterDto: FilterOrdersDto): Promise<{ data: OrderResponseDto[]; meta: { total: number; page: number; limit: number, totalPages: number } }> {
        const {
            search,
            customerName,
            orderDateFrom,
            orderDateTo,
            status,
            orderType,
            customerId,
            orderId,
            zoneId,
            page = 1,
            limit = 10,
            sortBy
        } = filterDto;

        const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
        const take = Math.max(1, limit);
        const where: Prisma.order_headerWhereInput = {};
        
        if (orderId) where.order_id = orderId;
        if (status) where.status = status as PrismaOrderStatus;
        if (orderType) where.order_type = orderType as PrismaOrderType;
        if (customerId) where.customer_id = customerId;
        
        let customerConditions: Prisma.personWhereInput[] = [];
        if (zoneId) {
            customerConditions.push({ zone_id: zoneId });
            customerConditions.push({ locality: { zones: { some: { zone_id: zoneId } } } });
        }
        if (customerName) {
             customerConditions.push({ name: { contains: customerName, mode: 'insensitive' }});
        }
        if (customerConditions.length > 0) {
            where.customer = { OR: customerConditions.length > 1 ? customerConditions : undefined, AND: customerConditions.length === 1 ? customerConditions[0] : undefined };
        }
        
        if (search) {
            const searchAsNumber = !isNaN(parseInt(search)) ? parseInt(search) : undefined;
            const orConditions: Prisma.order_headerWhereInput[] = [];
            orConditions.push({
                customer: {
                    name: { contains: search, mode: 'insensitive' }
                }
            });
            if (searchAsNumber) {
                orConditions.push({ order_id: searchAsNumber });
            }
            if(where.OR) {
                 where.OR = where.OR.concat(orConditions); 
            } else {
                where.OR = orConditions;
            }
        }
        
        if (orderDateFrom || orderDateTo) {
            where.order_date = {};
            if (orderDateFrom) where.order_date.gte = new Date(orderDateFrom);
            if (orderDateTo) { 
                const toDate = new Date(orderDateTo); 
                toDate.setHours(23, 59, 59, 999); 
                where.order_date.lte = toDate; 
            }
        }
        
        const orderByClause = parseSortByString(sortBy, [{ order_date: 'desc' }]);

        try {
            const totalOrders = await this.order_header.count({ where });

            const orders = await this.order_header.findMany({
                where, 
                include: { 
                    order_item: { include: { product: true } }, 
                    customer: { 
                        include: { 
                            locality: { include: { zones: true } }, 
                            zone: true 
                        } 
                    }, 
                    sale_channel: true,
                    customer_subscription: true,
                    client_contract: true
                },
                orderBy: orderByClause,
                skip,
                take,
            });
            
            return {
                data: orders.map(order => this.mapToOrderResponseDto(order)),
                meta: {
                    total: totalOrders,
                    page,
                    limit: take,
                    totalPages: Math.ceil(totalOrders / take)
                }
            }
        } catch (error) {
            handlePrismaError(error, `${this.entityName}s`);
            throw new InternalServerErrorException('Error no manejado después de handlePrismaError en findAll orders.');
        }
    }

    async findOne(id: number): Promise<OrderResponseDto> {
        try {
            const order = await this.order_header.findUniqueOrThrow({
                where: { order_id: id },
                include: { 
                    order_item: { include: { product: true } }, 
                    customer: { include: { locality: { include: { zones: true } }, zone: true } }, 
                    sale_channel: true, 
                    customer_subscription: true, 
                    client_contract: true 
                },
            });
            return this.mapToOrderResponseDto(order);
        } catch (error) {
            handlePrismaError(error, this.entityName);
            if (!(error instanceof NotFoundException)) {
                throw new InternalServerErrorException('Error no manejado después de handlePrismaError en findOne order.');
            }
            throw error;
        }
    }

    async update(id: number, updateOrderDto: UpdateOrderDto): Promise<OrderResponseDto> {
        const { items_to_update_or_create, item_ids_to_delete, ...orderHeaderDataToUpdateInput } = updateOrderDto;
        const dataToUpdate: Prisma.order_headerUpdateInput = {};

        for (const key in orderHeaderDataToUpdateInput) {
            if (orderHeaderDataToUpdateInput[key] !== undefined && key !== 'order_type' && key !== 'status') {
                (dataToUpdate as any)[key] = (orderHeaderDataToUpdateInput as any)[key];
            }
        }
        
        if (orderHeaderDataToUpdateInput.order_type) {
            dataToUpdate.order_type = { set: orderHeaderDataToUpdateInput.order_type as PrismaOrderType };
        }
        if (orderHeaderDataToUpdateInput.status) {
            dataToUpdate.status = { set: orderHeaderDataToUpdateInput.status as PrismaOrderStatus };
        }

        try {
            const order = await this.$transaction(async (tx) => {
                const existingOrder = await tx.order_header.findUniqueOrThrow({ 
                    where: { order_id: id }, 
                    include: { order_item: { include: { product: true } } }
                }).catch(() => { throw new NotFoundException(`${this.entityName} con ID ${id} no encontrado.`); });

                if (items_to_update_or_create && items_to_update_or_create.length > 0) {
                    const saleMovementTypeId = await this.inventoryService.getMovementTypeIdByCode(BUSINESS_CONFIG.MOVEMENT_TYPES.EGRESO_VENTA_PRODUCTO, tx);
                    for (const itemDto of items_to_update_or_create) {
                        const productDetails = await tx.product.findUniqueOrThrow({ where: { product_id: itemDto.product_id }});
                        let quantityChange = 0;
                        const existingItem = existingOrder.order_item.find(oi => oi.order_item_id === itemDto.order_item_id);

                        if (existingItem) { 
                            quantityChange = itemDto.quantity - existingItem.quantity;
                        } else { 
                            quantityChange = itemDto.quantity;
                        }

                        if (quantityChange > 0 && !productDetails.is_returnable) { 
                            const stockDisponible = await this.inventoryService.getProductStock(itemDto.product_id, BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID, tx);
                            if (stockDisponible < quantityChange) {
                                throw new BadRequestException(
                                    `${this.entityName}: Stock insuficiente para ${productDetails.description}. Se necesita ${quantityChange} adicional, disponible: ${stockDisponible}.`
                                );
                            }
                        }
                    }
                }
                
                if (Object.keys(dataToUpdate).length > 0) {
                    await tx.order_header.update({ where: { order_id: id }, data: dataToUpdate });
                }

                if (item_ids_to_delete && item_ids_to_delete.length > 0) {
                    const itemsBeingDeleted = existingOrder.order_item.filter(item => item_ids_to_delete.includes(item.order_item_id));
                    const returnMovementTypeId = await this.inventoryService.getMovementTypeIdByCode('INGRESO_DEVOLUCION_CLIENTE', tx);

                    for (const itemToDelete of itemsBeingDeleted) {
                        if (!itemToDelete.product.is_returnable && itemToDelete.quantity > 0) {
                             await this.inventoryService.createStockMovement({
                                movement_type_id: returnMovementTypeId,
                                product_id: itemToDelete.product_id,
                                quantity: itemToDelete.quantity, 
                                source_warehouse_id: null, 
                                destination_warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID, 
                                movement_date: new Date(),
                                remarks: `${this.entityName} #${id} - Devolución por eliminación de ítem ${itemToDelete.product_id} (${itemToDelete.product.description})`
                            }, tx);
                        }
                    }
                    await tx.order_item.deleteMany({ where: { order_item_id: { in: item_ids_to_delete }, order_id: id } });
                }

                if (items_to_update_or_create && items_to_update_or_create.length > 0) {
                    const saleMovementTypeId = await this.inventoryService.getMovementTypeIdByCode(BUSINESS_CONFIG.MOVEMENT_TYPES.EGRESO_VENTA_PRODUCTO, tx);
                    for (const itemDto of items_to_update_or_create) {
                        const product = await tx.product.findUniqueOrThrow({ where: { product_id: itemDto.product_id } });
                        const productPrice = new Decimal(product.price);
                        const quantityDecimal = new Decimal(itemDto.quantity);
                        const subtotal = productPrice.mul(quantityDecimal);
                        const totalAmountItem = subtotal;
                        
                        const existingItem = existingOrder.order_item.find(i => i.order_item_id === itemDto.order_item_id);
                        let quantityChange = 0;

                        if (existingItem) { 
                            quantityChange = itemDto.quantity - existingItem.quantity;
                            await tx.order_item.update({ 
                                where: { order_item_id: itemDto.order_item_id }, 
                                data: { 
                                    product_id: itemDto.product_id, 
                                    quantity: itemDto.quantity, 
                                    subtotal: subtotal.toString(), 
                                    total_amount: totalAmountItem.toString(), 
                                }
                            });
                        } else { 
                            quantityChange = itemDto.quantity;
                            await tx.order_item.create({ 
                                data: { 
                                    order_id: id, 
                                    product_id: itemDto.product_id, 
                                    quantity: itemDto.quantity, 
                                    subtotal: subtotal.toString(), 
                                    total_amount: totalAmountItem.toString(), 
                                    amount_paid: '0.00'
                                }
                            });
                        }

                        if (quantityChange !== 0 && !product.is_returnable) { 
                            const movementTypeForUpdate = quantityChange > 0 ? saleMovementTypeId : await this.inventoryService.getMovementTypeIdByCode('INGRESO_DEVOLUCION_CLIENTE', tx);
                            await this.inventoryService.createStockMovement({
                                movement_type_id: movementTypeForUpdate,
                                product_id: itemDto.product_id,
                                quantity: Math.abs(quantityChange),
                                source_warehouse_id: quantityChange < 0 ? null : BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                                destination_warehouse_id: quantityChange < 0 ? BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID : null,
                                movement_date: new Date(),
                                remarks: `${this.entityName} #${id} - Ajuste producto ${itemDto.product_id} (${product.description}), cantidad: ${quantityChange}`
                            }, tx);
                        }
                    }
                }

                const updatedOrderItems = await tx.order_item.findMany({ where: { order_id: id } });
                const newOrderTotalAmount = updatedOrderItems.reduce((sum, item) => sum.plus(new Decimal(item.total_amount)), new Decimal(0));
                const currentPaidAmount = new Decimal(existingOrder.paid_amount);
                await tx.order_header.update({ 
                    where: { order_id: id }, 
                    data: { 
                        total_amount: newOrderTotalAmount.toString(),
                        paid_amount: newOrderTotalAmount.lessThan(currentPaidAmount) ? newOrderTotalAmount.toString() : currentPaidAmount.toString()
                    }
                });

                const finalOrder = await tx.order_header.findUniqueOrThrow({ 
                    where: { order_id: id }, 
                    include: { 
                        order_item: { include: { product: true } }, 
                        customer: { include: { locality: { include: { zones: true } }, zone: true } }, 
                        sale_channel: true, 
                        customer_subscription: true, 
                        client_contract: true 
                    }
                });
                return this.mapToOrderResponseDto(finalOrder);
            });
            return order;
        } catch (error) {
            handlePrismaError(error, this.entityName);
            if (!(error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException || error instanceof InternalServerErrorException)) {
                throw new InternalServerErrorException('Error no manejado después de handlePrismaError en update order.');
            }
            throw error;
        }
    }

    async remove(id: number): Promise<{ message: string; deleted: boolean }> {
        await this.findOne(id);
        try {
            await this.$transaction(async (tx) => {
                const orderItems = await tx.order_item.findMany({ where: { order_id: id }, include: { product: true } });
                const returnMovementTypeId = await this.inventoryService.getMovementTypeIdByCode('INGRESO_DEVOLUCION_PEDIDO_CANCELADO', tx);
                
                for(const item of orderItems) {
                    if (!item.product.is_returnable && item.quantity > 0) {
                        await this.inventoryService.createStockMovement({
                            movement_type_id: returnMovementTypeId,
                            product_id: item.product_id,
                            quantity: item.quantity,
                            source_warehouse_id: null,
                            destination_warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                            movement_date: new Date(),
                            remarks: `${this.entityName} #${id} CANCELADO - Devolución ${item.product.description} (ID ${item.product_id})`
                        }, tx);
                    }
                }

                await tx.installment_order_link.deleteMany({ where: { order_id: id } });
                await tx.payment_transaction.updateMany({ where: { order_id: id }, data: { order_id: null } });
                await tx.route_sheet_detail.deleteMany({ where: { order_id: id } });
                await tx.order_item.deleteMany({ where: { order_id: id } });
                await tx.order_header.delete({ where: { order_id: id } });
            });
            return { message: `${this.entityName} con ID ${id} y sus ítems asociados han sido eliminados. El stock de productos no retornables (si aplica) ha sido ajustado.`, deleted: true };
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
                 handlePrismaError(error, `El ${this.entityName.toLowerCase()} con ID ${id} no se puede eliminar porque tiene datos relacionados (ej. en hojas de ruta activas).`);
            } else {
                 handlePrismaError(error, this.entityName);
            }
            
            if (!(error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException || error instanceof InternalServerErrorException)) {
                throw new InternalServerErrorException('Error no manejado después de handlePrismaError en remove order.');
            }
            throw error;
        }
    }
}
