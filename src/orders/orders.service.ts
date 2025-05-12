import { Injectable, NotFoundException, OnModuleInit, InternalServerErrorException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma, order_header as PrismaOrderHeader, order_item as PrismaOrderItem, OrderStatus as PrismaOrderStatus, OrderType as PrismaOrderType, product as PrismaProduct, person as PrismaPerson, sale_channel as PrismaSaleChannel, client_contract as PrismaClientContract } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { InventoryService } from '../inventory/inventory.service';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderResponseDto, OrderItemResponseDto } from './dto/order-response.dto';
import { OrderStatus as AppOrderStatus, OrderType as AppOrderType } from '../common/constants/enums';
import { CreateStockMovementDto } from '../inventory/dto/create-stock-movement.dto';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
    // Asumimos que el ID del almacén principal es 1. Esto debería ser configurable en el futuro.
    private readonly ID_ALMACEN_PRINCIPAL = 1;
    private readonly CODIGO_SALIDA_POR_VENTA = 'EGRESO_VENTA_PRODUCTO';

    constructor(private readonly inventoryService: InventoryService) { 
        super(); 
    }

    async onModuleInit() {
        await this.$connect();
    }

    private mapToOrderResponseDto(order: PrismaOrderHeader & {
        order_item?: (PrismaOrderItem & { product: PrismaProduct })[];
        customer?: PrismaPerson | null;
        sale_channel?: PrismaSaleChannel | null;
        client_contract?: PrismaClientContract | null;
    }): OrderResponseDto {
        const customerData = order.customer 
            ? { person_id: order.customer.person_id, name: order.customer.name || '', phone: order.customer.phone }
            : { person_id: 0, name: '', phone: '' };

        const saleChannelData = order.sale_channel
            ? { sale_channel_id: order.sale_channel.sale_channel_id, name: order.sale_channel.description || '' }
            : { sale_channel_id: 0, name: '' };

        return {
            order_id: order.order_id,
            customer_id: order.customer_id,
            contract_id: order.contract_id ?? undefined,
            sale_channel_id: order.sale_channel_id,
            order_date: order.order_date.toISOString(),
            scheduled_delivery_date: order.scheduled_delivery_date ? order.scheduled_delivery_date.toISOString() : undefined,
            delivery_time: order.delivery_time instanceof Date ? order.delivery_time.toTimeString().slice(0,8) : (typeof order.delivery_time === 'string' ? order.delivery_time : undefined),
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
            customer: customerData,
            sale_channel: saleChannelData,
        };
    }

    private async validateOrderData(createOrderDto: CreateOrderDto) {
        const customer = await this.person.findUnique({ where: { person_id: createOrderDto.customer_id } });
        if (!customer) throw new NotFoundException(`Cliente con ID ${createOrderDto.customer_id} no encontrado.`);

        const saleChannel = await this.sale_channel.findUnique({ where: { sale_channel_id: createOrderDto.sale_channel_id } });
        if (!saleChannel) throw new NotFoundException(`Canal de venta con ID ${createOrderDto.sale_channel_id} no encontrado.`);

        if (createOrderDto.contract_id) {
            const contract = await this.client_contract.findUnique({ where: { contract_id: createOrderDto.contract_id } });
            if (!contract) throw new NotFoundException(`Contrato con ID ${createOrderDto.contract_id} no encontrado.`);
        }

        if (createOrderDto.subscription_id) {
            const subscription = await this.customer_subscription.findUnique({ where: { subscription_id: createOrderDto.subscription_id } });
            if (!subscription) throw new NotFoundException(`Suscripción con ID ${createOrderDto.subscription_id} no encontrada.`);
        }

        const totalAmount = new Decimal(createOrderDto.total_amount);
        const paidAmount = new Decimal(createOrderDto.paid_amount);
        if (paidAmount.greaterThan(totalAmount)) throw new BadRequestException('El monto pagado no puede ser mayor al monto total del pedido.');

        if (createOrderDto.scheduled_delivery_date) {
            const orderDate = new Date(createOrderDto.order_date);
            const deliveryDate = new Date(createOrderDto.scheduled_delivery_date);
            if (deliveryDate <= orderDate) throw new BadRequestException('La fecha de entrega programada debe ser posterior a la fecha del pedido.');
        }
    }

    async create(createOrderDto: CreateOrderDto, tx?: Prisma.TransactionClient): Promise<OrderResponseDto> {
        const prisma = tx || this;

        // Validar el monto total si se proporciona
        // Esta validación de total_amount debe usar los precios de la base de datos, no los del DTO.
        // Se hará más adelante dentro de la transacción después de obtener los precios reales.

        return this.$transaction(async (prismaTx) => {
            // Validar datos generales del DTO
            await this.validateOrderData(createOrderDto); // Llamar a la validación general

            const { customer_id, sale_channel_id, items, subscription_id, contract_id, total_amount: dtoTotalAmountStr, ...restOfDto } = createOrderDto;

            // Calcular el total real basado en los productos de la BD y las cantidades del DTO
            let calculatedTotalFromDB = new Decimal(0);
            const orderItemsDataForCreation: Prisma.order_itemUncheckedCreateWithoutOrder_headerInput[] = [];

            for (const itemDto of items) {
                const productDetails = await prismaTx.product.findUnique({
                    where: { product_id: itemDto.product_id },
                });
                if (!productDetails) {
                    throw new NotFoundException(`Producto con ID ${itemDto.product_id} no encontrado.`);
                }
                const itemSubtotal = new Decimal(productDetails.price).mul(itemDto.quantity);
                calculatedTotalFromDB = calculatedTotalFromDB.plus(itemSubtotal);
                orderItemsDataForCreation.push({
                    product_id: itemDto.product_id,
                    quantity: itemDto.quantity,
                    subtotal: itemSubtotal.toString(),
                    total_amount: itemSubtotal.toString(), // total_amount del item es su subtotal
                    amount_paid: '0.00', // Inicialmente no pagado por item
                });
            }

            // Validar el total_amount del DTO contra el calculado con precios de la BD
            if (dtoTotalAmountStr && !new Decimal(dtoTotalAmountStr).equals(calculatedTotalFromDB)) {
                throw new BadRequestException(
                    `El total_amount enviado (${dtoTotalAmountStr}) no coincide con el calculado desde la base de datos (${calculatedTotalFromDB.toString()}).`
                );
            }

            // 1. Obtener ID del tipo de movimiento para "Salida por Venta"
            const saleMovementTypeId = await this.inventoryService.getMovementTypeIdByCode(
                this.CODIGO_SALIDA_POR_VENTA,
                prismaTx,
            );

            // 2. Validar stock y detalles del producto para cada item (ya se hizo para productDetails)
            for (const itemDto of items) {
                // productDetails ya se obtuvo arriba y se validó.
                const productDetails = await prismaTx.product.findUnique({ where: { product_id: itemDto.product_id } }); // Re-obtener para no depender de variable externa al loop si cambia
                 if (!productDetails) { // Doble chequeo, aunque no debería ser necesario si el código es lineal
                    throw new NotFoundException(`Producto con ID ${itemDto.product_id} no encontrado durante validación de stock.`);
                }

                const stockDisponible = await this.inventoryService.getProductStock(
                    itemDto.product_id,
                    this.ID_ALMACEN_PRINCIPAL,
                    prismaTx,
                );

                if (stockDisponible < itemDto.quantity && !productDetails.is_returnable) {
                    throw new BadRequestException(
                        `Stock insuficiente para el producto ${productDetails.description} (ID: ${itemDto.product_id}). Disponible: ${stockDisponible}, Solicitado: ${itemDto.quantity}.`,
                    );
                }
            }

            // 3. Crear OrderHeader
            const newOrderHeader = await prismaTx.order_header.create({
                data: {
                    ...restOfDto,
                    order_date: restOfDto.order_date ? new Date(restOfDto.order_date) : new Date(),
                    scheduled_delivery_date: restOfDto.scheduled_delivery_date ? new Date(restOfDto.scheduled_delivery_date) : undefined,
                    total_amount: calculatedTotalFromDB.toString(), // Usar el total calculado desde la BD
                    paid_amount: new Decimal(createOrderDto.paid_amount || '0').toString(), // Usar paid_amount del DTO o 0
                    status: (restOfDto.status as PrismaOrderStatus) || PrismaOrderStatus.PENDING, // Usar status del DTO o PENDING
                    customer: { connect: { person_id: customer_id } },
                    sale_channel: { connect: { sale_channel_id: sale_channel_id || 1 } },
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
                    order_item: { include: { product: true } }, // Incluir product aquí es importante
                    customer: true,
                    sale_channel: true,
                },
            });

            // 4. Crear movimientos de stock para cada item del pedido
            // Los items ya están en newOrderHeader.order_item gracias al include
            for (const createdItem of newOrderHeader.order_item) {
                const stockMovementDto: CreateStockMovementDto = {
                    movement_type_id: saleMovementTypeId,
                    product_id: createdItem.product_id,
                    quantity: createdItem.quantity,
                    source_warehouse_id: this.ID_ALMACEN_PRINCIPAL,
                    destination_warehouse_id: null,
                    movement_date: new Date(), 
                    remarks: `Venta Pedido #${newOrderHeader.order_id} - Producto ${createdItem.product_id}`,
                };
                await this.inventoryService.createStockMovement(stockMovementDto, prismaTx);
            }
            
            const fullOrder = await prismaTx.order_header.findUnique({
                where: { order_id: newOrderHeader.order_id },
                include: {
                    order_item: { include: { product: true } },
                    customer: { include: { locality: true, zone: true } },
                    sale_channel: true,
                    customer_subscription: true, 
                    client_contract: true,     
                },
            });

            if (!fullOrder) { 
                throw new InternalServerErrorException('No se pudo recuperar el pedido recién creado.')
            }

            return this.mapToOrderResponseDto(fullOrder as any); 
        });
    }

    async findAll(filterOrdersDto: FilterOrdersDto): Promise<OrderResponseDto[]> {
        const { customerName, orderDateFrom, orderDateTo, status, orderType, customerId, page = 1, limit = 10 } = filterOrdersDto;
        const skip = (page - 1) * limit;
        const where: Prisma.order_headerWhereInput = {};
        if (status) where.status = status as PrismaOrderStatus;
        if (orderType) where.order_type = orderType as PrismaOrderType;
        if (customerId) where.customer_id = customerId;
        if (customerName) where.customer = { name: { contains: customerName, mode: 'insensitive' } };
        if (orderDateFrom || orderDateTo) {
            where.order_date = {};
            if (orderDateFrom) where.order_date.gte = new Date(orderDateFrom);
            if (orderDateTo) { const toDate = new Date(orderDateTo); toDate.setHours(23, 59, 59, 999); where.order_date.lte = toDate; }
        }
        try {
            const orders = await this.order_header.findMany({
                where, include: { order_item: { include: { product: true } }, customer: true, sale_channel: true },
                orderBy: { order_date: 'desc' }, skip: skip, take: limit,
            });
            return orders.map(order => this.mapToOrderResponseDto(order));
        } catch (error) {
            console.error('Error al obtener los pedidos:', error);
            throw new InternalServerErrorException('Error al obtener los pedidos.');
        }
    }

    async findOne(id: number): Promise<OrderResponseDto> {
        try {
            const order = await this.order_header.findUnique({
                where: { order_id: id },
                include: { order_item: { include: { product: true } }, customer: true, sale_channel: true, client_contract: true },
            });
            if (!order) throw new NotFoundException(`Pedido con ID ${id} no encontrado.`);
            return this.mapToOrderResponseDto(order);
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error(`Error al obtener el pedido con ID ${id}:`, error);
            throw new InternalServerErrorException(`Error al obtener el pedido con ID ${id}.`);
        }
    }

    async update(id: number, updateOrderDto: UpdateOrderDto): Promise<OrderResponseDto> {
        const { items_to_update_or_create, item_ids_to_delete, ...orderHeaderDataToUpdateInput } = updateOrderDto;
        
        // Inicializa dataToUpdate con los campos que no son enums o que no necesitan manejo especial
        const dataToUpdate: Prisma.order_headerUpdateInput = {};

        // Copiar propiedades directas (no enums problemáticos)
        for (const key in orderHeaderDataToUpdateInput) {
            if (key !== 'order_type' && key !== 'status') {
                (dataToUpdate as any)[key] = (orderHeaderDataToUpdateInput as any)[key];
            }
        }
        
        // Manejo especial para enums: Prisma espera { set: EnumValue } para este tipo de input
        if (orderHeaderDataToUpdateInput.order_type) {
            dataToUpdate.order_type = { set: orderHeaderDataToUpdateInput.order_type as PrismaOrderType };
        }
        if (orderHeaderDataToUpdateInput.status) {
            dataToUpdate.status = { set: orderHeaderDataToUpdateInput.status as PrismaOrderStatus };
        }

        const order = await this.$transaction(async (tx) => {
            const existingOrder = await tx.order_header.findUniqueOrThrow({ where: { order_id: id }, include: { order_item: true } });

            if (items_to_update_or_create && items_to_update_or_create.length > 0) {
                for (const itemDto of items_to_update_or_create) {
                    const productId = itemDto.product_id;
                    const requestedQuantity = itemDto.quantity;
                    let quantityToCheck = 0;
                    if (itemDto.order_item_id) {
                        const originalItem = existingOrder.order_item.find(oi => oi.order_item_id === itemDto.order_item_id);
                        if (!originalItem) throw new NotFoundException(`Ítem con ID ${itemDto.order_item_id} no encontrado.`);
                        if (originalItem.product_id !== productId) quantityToCheck = requestedQuantity;
                        else if (requestedQuantity > originalItem.quantity) quantityToCheck = requestedQuantity - originalItem.quantity;
                    } else quantityToCheck = requestedQuantity;

                    if (quantityToCheck > 0) {
                        // const availableStock = await this.inventoryService.getProductStock(productId);
                        // if (availableStock < quantityToCheck) { ... }
                        // Comentado: Revisar InventoryService y getProductStock.
                    }
                }
            }
            
            // Solo actualiza si hay datos en dataToUpdate
            if (Object.keys(dataToUpdate).length > 0) {
                await tx.order_header.update({ where: { order_id: id }, data: dataToUpdate });
            }

            if (item_ids_to_delete && item_ids_to_delete.length > 0) {
                const itemsToDelete = existingOrder.order_item.filter(item => item_ids_to_delete.includes(item.order_item_id)).map(item => item.order_item_id);
                if (itemsToDelete.length > 0) await tx.order_item.deleteMany({ where: { order_item_id: { in: itemsToDelete }, order_id: id } });
            }

            if (items_to_update_or_create && items_to_update_or_create.length > 0) {
                for (const itemDto of items_to_update_or_create) {
                    const product = await tx.product.findUniqueOrThrow({ where: { product_id: itemDto.product_id } });
                    const productPrice = new Decimal(product.price);
                    const quantityDecimal = new Decimal(itemDto.quantity);
                    const subtotal = productPrice.mul(quantityDecimal);
                    const totalAmountItem = subtotal;
                    if (itemDto.order_item_id) {
                        const existingItem = existingOrder.order_item.find(i => i.order_item_id === itemDto.order_item_id);
                        if (!existingItem) throw new NotFoundException(`Ítem con ID ${itemDto.order_item_id} para actualizar no encontrado.`);
                        await tx.order_item.update({ where: { order_item_id: itemDto.order_item_id }, data: { product_id: itemDto.product_id, quantity: itemDto.quantity, subtotal: subtotal.toString(), total_amount: totalAmountItem.toString(), amount_paid: existingItem.amount_paid.toString() } });
                    } else {
                        await tx.order_item.create({ data: { order_id: id, product_id: itemDto.product_id, quantity: itemDto.quantity, subtotal: subtotal.toString(), total_amount: totalAmountItem.toString(), amount_paid: '0.00' } });
                    }
                }
            }

            const updatedOrderItems = await tx.order_item.findMany({ where: { order_id: id } });
            const newOrderTotalAmount = updatedOrderItems.reduce((sum, item) => sum.plus(new Decimal(item.total_amount)), new Decimal(0));
            await tx.order_header.update({ where: { order_id: id }, data: { total_amount: newOrderTotalAmount.toString() } });

            return tx.order_header.findUniqueOrThrow({ where: { order_id: id }, include: { order_item: { include: { product: true } }, customer: true, sale_channel: true, client_contract: true } });
        });
        return this.mapToOrderResponseDto(order);
    }

    async remove(id: number): Promise<{ message: string; deleted: boolean }> {
        await this.findOne(id); // Verifica que exista
        try {
            await this.$transaction(async (tx) => {
                await tx.installment_order_link.deleteMany({ where: { order_id: id } });
                await tx.payment_transaction.deleteMany({ where: { order_id: id } });
                await tx.route_sheet_detail.deleteMany({ where: { order_id: id } });
                await tx.order_item.deleteMany({ where: { order_id: id } });
                await tx.order_header.delete({ where: { order_id: id } });
            });
            return { message: `Pedido con ID ${id} y sus datos asociados directos han sido eliminados correctamente.`, deleted: true };
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2003') throw new ConflictException(`Error al eliminar el pedido con ID ${id}: Aún tiene datos relacionados.`);
                if (error.code === 'P2025') throw new NotFoundException(`Pedido con ID ${id} no encontrado para eliminar.`);
            }
            console.error(`Error al eliminar el pedido con ID ${id}:`, error);
            throw new InternalServerErrorException(`Error al eliminar el pedido con ID ${id}.`);
        }
    }
}
