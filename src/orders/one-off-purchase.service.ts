import { Injectable, NotFoundException, OnModuleInit, InternalServerErrorException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { PersonType } from '../common/constants/enums';
import { CreateOneOffPurchaseDto } from './dto/create-one-off-purchase.dto';
import { UpdateOneOffPurchaseDto } from './dto/update-one-off-purchase.dto';
import { FilterOneOffPurchasesDto } from './dto/filter-one-off-purchases.dto';
import { OneOffPurchaseResponseDto } from './dto/one-off-purchase-response.dto';
import { InventoryService } from '../inventory/inventory.service';
import { CreateStockMovementDto } from '../inventory/dto/create-stock-movement.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { BUSINESS_CONFIG } from '../common/config/business.config';

@Injectable()
export class OneOffPurchaseService extends PrismaClient implements OnModuleInit {
    
    constructor(private readonly inventoryService: InventoryService) {
        super();
    }

    async onModuleInit() {
        await this.$connect();
    }
  
    async findAllSimpleOneOff(): Promise<any> {
        try {
            const purchases = await this.one_off_purchase.findMany({
                include: { 
                    product: true, 
                    person: true, 
                    sale_channel: true, 
                    locality: true, 
                    zone: true,
                    price_list: true 
                },
                orderBy: { purchase_date: 'desc' }
            });
            
            return purchases.map(purchase => ({
                purchase_id: purchase.purchase_id,
                person_id: purchase.person_id,
                purchase_date: purchase.purchase_date.toISOString(),
                total_amount: purchase.total_amount.toString(),
                paid_amount: purchase.paid_amount.toString(),
                notes: purchase.notes,
                delivery_address: purchase.delivery_address,
                person: {
                    person_id: purchase.person.person_id,
                    name: purchase.person.name || 'Nombre no disponible',
                    phone: purchase.person.phone,
                    tax_id: purchase.person.tax_id
                },
                products: [{
                    product_id: purchase.product_id,
                    description: purchase.product.description,
                    quantity: purchase.quantity,
                    price_list: purchase.price_list 
                        ? {
                            price_list_id: purchase.price_list.price_list_id,
                            name: purchase.price_list.name,
                            unit_price: (purchase.total_amount.div(purchase.quantity)).toString()
                        }
                        : undefined
                }],
                sale_channel: {
                    sale_channel_id: purchase.sale_channel.sale_channel_id,
                    name: purchase.sale_channel.description || 'Canal no disponible'
                },
                locality: purchase.locality ? {
                    locality_id: purchase.locality.locality_id,
                    name: purchase.locality.name
                } : null,
                zone: purchase.zone ? {
                    zone_id: purchase.zone.zone_id,
                    name: purchase.zone.name
                } : null
            }));
        } catch (error) {
            handlePrismaError(error, 'Compra de Única Vez');
            if (!(error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException || error instanceof InternalServerErrorException)) {
                throw new InternalServerErrorException(`Error no manejado al buscar compras de única vez`);
            }
            throw error;
        }
    }

    async createOneOff(createDto: CreateOneOffPurchaseDto): Promise<OneOffPurchaseResponseDto> {
        try {
            return await this.$transaction(async (prismaTx) => {
                // Validar que hay items
                if (!createDto.items || createDto.items.length === 0) {
                    throw new BadRequestException('Debe especificar al menos un producto en la compra.');
                }

                // Tomar el primer item (limitación actual del sistema)
                const firstItem = createDto.items[0];
                const product = await prismaTx.product.findUniqueOrThrow({ where: { product_id: firstItem.product_id } });
                
                // Determinar qué lista de precios usar
                const priceListId = firstItem.price_list_id || BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID;
                
                // Buscar precio en la lista específica
                let itemPrice = new Decimal(product.price); // Precio base como fallback
                
                const priceItem = await prismaTx.price_list_item.findFirst({
                    where: { 
                        price_list_id: priceListId,
                        product_id: firstItem.product_id 
                    }
                });
                
                if (priceItem) {
                    itemPrice = new Decimal(priceItem.unit_price);
                }
                
                const totalAmount = itemPrice.mul(firstItem.quantity);

                // Verificar stock para productos no retornables
                if (!product.is_returnable) {
                    const stockDisponible = await this.inventoryService.getProductStock(
                        firstItem.product_id, 
                        BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID, 
                        prismaTx
                    );
                    if (stockDisponible < firstItem.quantity) {
                        throw new BadRequestException(
                            `Compra One-Off: Stock insuficiente para ${product.description}. Disponible: ${stockDisponible}, Solicitado: ${firstItem.quantity}.`
                        );
                    }
                }

                const newPurchase = await prismaTx.one_off_purchase.create({
                    data: {
                        person_id: 0, // Este método ya no se usa, pero mantenemos la estructura
                        product_id: firstItem.product_id,
                        quantity: firstItem.quantity,
                        sale_channel_id: createDto.sale_channel_id,
                        price_list_id: priceListId,
                        delivery_address: createDto.delivery_address,
                        locality_id: createDto.locality_id,
                        zone_id: createDto.zone_id,
                        paid_amount: createDto.paid_amount ? new Decimal(createDto.paid_amount) : new Decimal(0),
                        notes: createDto.notes,
                        purchase_date: createDto.purchase_date ? new Date(createDto.purchase_date) : new Date(),
                        scheduled_delivery_date: createDto.scheduled_delivery_date ? new Date(createDto.scheduled_delivery_date) : null,
                        delivery_time: createDto.delivery_time,
                        total_amount: totalAmount,
                    },
                    include: { product: true, person: true, sale_channel: true, locality: true, zone: true, price_list: true },
                });

                // Crear movimiento de stock para productos no retornables
                if (!product.is_returnable) {
                    const saleMovementTypeId = await this.inventoryService.getMovementTypeIdByCode(
                        BUSINESS_CONFIG.MOVEMENT_TYPES.EGRESO_VENTA_UNICA,
                        prismaTx
                    );

                    const stockMovement: CreateStockMovementDto = {
                        movement_type_id: saleMovementTypeId,
                        product_id: firstItem.product_id,
                        quantity: firstItem.quantity,
                        source_warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                        movement_date: new Date(),
                        remarks: `Compra One-Off #${newPurchase.purchase_id} - ${product.description}`,
                    };
                    await this.inventoryService.createStockMovement(stockMovement, prismaTx);
                }

                return this.mapToOneOffPurchaseResponseDto(newPurchase);
            });
        } catch (error) {
            handlePrismaError(error, 'Compra One-Off');
            if (!(error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException || error instanceof InternalServerErrorException)) {
                throw new InternalServerErrorException(`Error no manejado al crear compra one-off`);
            }
            throw error;
        }
    }

    async createOneOffWithCustomerLogic(createDto: any): Promise<OneOffPurchaseResponseDto> {
        try {
            return await this.$transaction(async (prismaTx) => {
                // Validar que hay items
                if (!createDto.items || createDto.items.length === 0) {
                    throw new BadRequestException('Debe especificar al menos un producto en la compra.');
                }

                // Buscar o crear el cliente
                let person = await prismaTx.person.findFirst({
                    where: { phone: createDto.customer.phone }
                });

                if (!person) {
                    // Validar que se proporcionen los campos obligatorios para cliente nuevo
                    if (!createDto.customer.name || !createDto.customer.localityId || !createDto.customer.zoneId) {
                        throw new BadRequestException('Para clientes nuevos, debe proporcionar: name, localityId y zoneId');
                    }

                    // Crear nuevo cliente
                    person = await prismaTx.person.create({
                        data: {
                            name: createDto.customer.name,
                            phone: createDto.customer.phone,
                            alias: createDto.customer.alias,
                            address: createDto.customer.address,
                            tax_id: createDto.customer.taxId,
                            locality: { connect: { locality_id: createDto.customer.localityId } },
                            zone: { connect: { zone_id: createDto.customer.zoneId } },
                            type: (createDto.customer.type || 'INDIVIDUAL') as PersonType,
                        }
                    });
                }

                let totalAmount = new Decimal(0);
                const createdPurchases: any[] = [];

                // Procesar cada item en el array
                for (const item of createDto.items) {
                    // Verificar que el producto existe
                    const product = await prismaTx.product.findUnique({ where: { product_id: item.product_id } });
                    
                    if (!product) {
                        throw new BadRequestException(
                            `Producto con ID ${item.product_id} no encontrado. Verifique que el producto existe antes de crear la compra.`
                        );
                    }
                    
                    // Determinar qué lista de precios usar para este item específico
                    const itemPriceListId = item.price_list_id || BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID;
                    
                    // Buscar precio en la lista específica
                    let itemPrice = new Decimal(product.price); // Precio base como fallback
                    
                    const priceItem = await prismaTx.price_list_item.findFirst({
                        where: { 
                            price_list_id: itemPriceListId,
                            product_id: item.product_id 
                        }
                    });
                    
                    if (priceItem) {
                        itemPrice = new Decimal(priceItem.unit_price);
                    }
                    
                    const itemTotalAmount = itemPrice.mul(item.quantity);
                    totalAmount = totalAmount.add(itemTotalAmount);

                    // Verificar stock para productos no retornables
                    if (!product.is_returnable) {
                        const stockDisponible = await this.inventoryService.getProductStock(
                            item.product_id, 
                            BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID, 
                            prismaTx
                        );
                        if (stockDisponible < item.quantity) {
                            throw new BadRequestException(
                                `Compra One-Off: Stock insuficiente para ${product.description}. Disponible: ${stockDisponible}, Solicitado: ${item.quantity}.`
                            );
                        }
                    }

                    // Determinar dirección de entrega
                    const deliveryAddress = createDto.requires_delivery 
                        ? (createDto.delivery_address || person.address)
                        : null;

                    // Determinar localidad y zona para entrega
                    const deliveryLocalityId = createDto.locality_id || createDto.customer.localityId || person.locality_id;
                    const deliveryZoneId = createDto.zone_id || createDto.customer.zoneId || person.zone_id;

                    // Verificar que existe la price_list - obligatorio
                    const priceListExists = await prismaTx.price_list.findUnique({
                        where: { price_list_id: itemPriceListId }
                    });
                    
                    if (!priceListExists) {
                        throw new BadRequestException(
                            `Lista de precios con ID ${itemPriceListId} no encontrada. Verifique que la lista de precios existe antes de crear la compra.`
                        );
                    }

                    const newPurchase = await prismaTx.one_off_purchase.create({
                        data: {
                            person_id: person.person_id,
                            paid_amount: createDto.paid_amount ? new Decimal(createDto.paid_amount) : new Decimal(0),
                            notes: createDto.notes,
                            product_id: item.product_id,
                            quantity: item.quantity,
                            sale_channel_id: createDto.sale_channel_id,
                            price_list_id: itemPriceListId,
                            delivery_address: deliveryAddress,
                            locality_id: deliveryLocalityId,
                            zone_id: deliveryZoneId,
                            purchase_date: createDto.purchase_date ? new Date(createDto.purchase_date) : new Date(),
                            scheduled_delivery_date: createDto.scheduled_delivery_date ? new Date(createDto.scheduled_delivery_date) : null,
                            delivery_time: createDto.delivery_time,
                            total_amount: itemTotalAmount,
                        },
                        include: { product: true, person: true, sale_channel: true, locality: true, zone: true, price_list: true },
                    });

                    createdPurchases.push(newPurchase);

                    // Crear movimiento de stock para productos no retornables
                    if (!product.is_returnable) {
                        const saleMovementTypeId = await this.inventoryService.getMovementTypeIdByCode(
                            BUSINESS_CONFIG.MOVEMENT_TYPES.EGRESO_VENTA_UNICA,
                            prismaTx
                        );

                        const stockMovement: CreateStockMovementDto = {
                            movement_type_id: saleMovementTypeId,
                            product_id: item.product_id,
                            quantity: item.quantity,
                            source_warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                            movement_date: new Date(),
                            remarks: `Compra One-Off #${newPurchase.purchase_id} - ${product.description}`,
                        };
                        await this.inventoryService.createStockMovement(stockMovement, prismaTx);
                    }
                }

                // Validar que paid_amount sea igual a total_amount
                if (createDto.paid_amount !== undefined && createDto.paid_amount !== null) {
                    const paidAmount = new Decimal(createDto.paid_amount);
                    if (!paidAmount.equals(totalAmount)) {
                        throw new BadRequestException(
                            `El monto pagado (${paidAmount.toString()}) debe ser igual al monto total (${totalAmount.toString()}).`
                        );
                    }
                }

                // Retornar respuesta consolidada con todos los productos
                return this.mapToConsolidatedOneOffPurchaseResponseDto(createdPurchases);
            });
        } catch (error) {
            handlePrismaError(error, 'Compra One-Off con Cliente');
            if (!(error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException || error instanceof InternalServerErrorException)) {
                throw new InternalServerErrorException(`Error no manejado al crear compra one-off con cliente`);
            }
            throw error;
        }
    }

    async findAllOneOff(filters: FilterOneOffPurchasesDto): Promise<any> {
        const { 
            search, 
            customerName, 
            productName, 
            page = 1, 
            limit = 10, 
            sortBy, 
            purchaseDateFrom, 
            purchaseDateTo, 
            deliveryDateFrom,
            deliveryDateTo,
            person_id, 
            product_id, 
            sale_channel_id, 
            locality_id, 
            zone_id } = filters;
        const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
        const take = Math.max(1, limit);
        const where: Prisma.one_off_purchaseWhereInput = {};

        if (person_id) where.person_id = person_id;
        if (product_id) where.product_id = product_id;
        if (sale_channel_id) where.sale_channel_id = sale_channel_id;
        if (locality_id) where.locality_id = locality_id;
        if (zone_id) where.zone_id = zone_id;

        const personFilter: Prisma.personWhereInput = {};
        if (customerName) {
            personFilter.name = { contains: customerName, mode: 'insensitive' };
        }
        if (Object.keys(personFilter).length > 0) {
            where.person = personFilter;
        }

        const productFilter: Prisma.productWhereInput = {};
        if (productName) {
            productFilter.description = { contains: productName, mode: 'insensitive' };
        }
        if (Object.keys(productFilter).length > 0) {
            where.product = productFilter;
        }

        if (search) {
            const searchNum = parseInt(search);
            const orConditions: Prisma.one_off_purchaseWhereInput[] = [
                { person: { name: { contains: search, mode: 'insensitive' } } },
                { product: { description: { contains: search, mode: 'insensitive' } } },
            ];
            if (!isNaN(searchNum)) {
                orConditions.push({ purchase_id: searchNum });
            }
            if (where.OR) {
                where.OR = where.OR.concat(orConditions);
            } else {
                where.OR = orConditions;
            }
        }

        // Validación de rangos de fechas de compra
        if (purchaseDateFrom && purchaseDateTo) {
            console.log('Validando fechas de compra:', { purchaseDateFrom, purchaseDateTo });
            const fromDate = new Date(purchaseDateFrom);
            const toDate = new Date(purchaseDateTo);
            if (toDate < fromDate) {
                throw new BadRequestException('La fecha de compra "hasta" no puede ser menor que la fecha de compra "desde"');
            }
        }

        // Validación de rangos de fechas de entrega
        if (deliveryDateFrom && deliveryDateTo) {
            const fromDate = new Date(deliveryDateFrom);
            const toDate = new Date(deliveryDateTo);
            if (toDate < fromDate) {
                throw new BadRequestException('La fecha de entrega "hasta" no puede ser menor que la fecha de entrega "desde"');
            }
        }

        if (purchaseDateFrom || purchaseDateTo) {
            where.purchase_date = {};
            
            if (purchaseDateFrom) {
                const fromDate = new Date(purchaseDateFrom);
                fromDate.setHours(0, 0, 0, 0);
                where.purchase_date.gte = fromDate;
            }
            if (purchaseDateTo) {
                const toDate = new Date(purchaseDateTo);
                toDate.setHours(23, 59, 59, 999);
                where.purchase_date.lte = toDate;
            }
            
            // Log para debugging del filtrado de fechas
            if (purchaseDateFrom && purchaseDateTo) {
                console.log('Fechas convertidas:', {
                    fromDate: where.purchase_date.gte,
                    toDate: where.purchase_date.lte,
                    isInvalid: false
                });
            }
        }

        // Filtros de fecha de entrega
        if (deliveryDateFrom || deliveryDateTo) {
            where.scheduled_delivery_date = {};
            if (deliveryDateFrom) {
                const fromDate = new Date(deliveryDateFrom);
                fromDate.setHours(0, 0, 0, 0);
                where.scheduled_delivery_date.gte = fromDate;
            }
            if (deliveryDateTo) {
                const toDate = new Date(deliveryDateTo);
                toDate.setHours(23, 59, 59, 999);
                where.scheduled_delivery_date.lte = toDate;
            }
        }

        const orderBy = parseSortByString(sortBy, [{ purchase_date: 'desc' }]);

        try {
            const total = await this.one_off_purchase.count({ where });
            const purchases = await this.one_off_purchase.findMany({
                where,
                include: { 
                    product: true, 
                    person: true, 
                    sale_channel: true, 
                    locality: true, 
                    zone: true,
                    price_list: true 
                },
                orderBy,
                skip,
                take,
            });
            // Agrupar compras por orden (person_id + fecha)
            const groupedPurchases = this.groupPurchasesByOrder(purchases);
            const consolidatedOrders = Array.from(groupedPurchases.values())
                .map(group => this.mapToConsolidatedOneOffPurchaseResponseDto(group));

            return {
                data: consolidatedOrders,
                meta: {
                    total: groupedPurchases.size, // Total de órdenes consolidadas
                    page,
                    limit: take,
                    totalPages: Math.ceil(groupedPurchases.size / take)
                }
            };
        } catch (error) {
            handlePrismaError(error, 'Compras One-Off');
            if (!(error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException || error instanceof InternalServerErrorException)) {
                throw new InternalServerErrorException(`Error no manejado al buscar compras one-off`);
            }
            throw error;
        }
    }

    async findOneOneOff(id: number): Promise<OneOffPurchaseResponseDto> {
        try {
            // Primero buscar la compra específica para obtener person_id y fecha
            const basePurchase = await this.one_off_purchase.findUniqueOrThrow({
                where: { purchase_id: id },
                include: { 
                    product: true, 
                    person: true, 
                    sale_channel: true, 
                    locality: true, 
                    zone: true,
                    price_list: true 
                },
            }).catch(() => { throw new NotFoundException(`Compra One-Off con ID ${id} no encontrada.`); });

            // Buscar todas las compras del mismo cliente en la misma fecha
            const purchaseDate = new Date(basePurchase.purchase_date);
            const startOfDay = new Date(purchaseDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(purchaseDate);
            endOfDay.setHours(23, 59, 59, 999);

            const relatedPurchases = await this.one_off_purchase.findMany({
                where: {
                    person_id: basePurchase.person_id,
                    purchase_date: {
                        gte: startOfDay,
                        lte: endOfDay
                    }
                },
                include: { 
                    product: true, 
                    person: true, 
                    sale_channel: true, 
                    locality: true, 
                    zone: true,
                    price_list: true 
                },
                orderBy: { purchase_id: 'asc' }
            });

            return this.mapToConsolidatedOneOffPurchaseResponseDto(relatedPurchases);
        } catch (error) {
            handlePrismaError(error, 'Compra One-Off');
            if (!(error instanceof NotFoundException || error instanceof InternalServerErrorException)) {
                throw new InternalServerErrorException(`Error no manejado al buscar compra one-off por ID.`);
            }
            throw error;
        }
    }

    async updateOneOff(id: number, updateDto: UpdateOneOffPurchaseDto): Promise<OneOffPurchaseResponseDto> {
        try {
            return await this.$transaction(async (prismaTx) => {
                const existingPurchase = await prismaTx.one_off_purchase.findUniqueOrThrow({
                    where: { purchase_id: id },
                    include: { product: true }
                }).catch(() => { throw new NotFoundException(`Compra One-Off con ID ${id} no encontrada.`); });

                await this.validateOneOffPurchaseData(updateDto, prismaTx);
                
                // Tomar el primer item (limitación actual del sistema)
                if (!updateDto.items || updateDto.items.length === 0) {
                    throw new BadRequestException('Debe especificar al menos un producto en la actualización.');
                }
                const firstItem = updateDto.items[0];
                const productForUpdate = await prismaTx.product.findUniqueOrThrow({ 
                    where: { product_id: firstItem.product_id } 
                });
                
                const newQuantity = firstItem.quantity;
                
                // Determinar la lista de precios a usar
                const priceListId = firstItem.price_list_id || BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID;
                
                // Buscar precio en la lista seleccionada, si no existe usar precio base
                let itemPrice = new Decimal(productForUpdate.price); // Precio base como fallback
                
                const priceItem = await prismaTx.price_list_item.findFirst({
                    where: { 
                        price_list_id: priceListId,
                        product_id: productForUpdate.product_id 
                    }
                });
                
                if (priceItem) {
                    itemPrice = new Decimal(priceItem.unit_price);
                }
                
                const newTotalAmount = itemPrice.mul(newQuantity);
                const quantityChange = newQuantity - existingPurchase.quantity;

                if (!productForUpdate.is_returnable && quantityChange !== 0) {
                    const stockDisponible = await this.inventoryService.getProductStock(productForUpdate.product_id, BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID, prismaTx);
                    if (quantityChange > 0 && stockDisponible < quantityChange) {
                        throw new BadRequestException(`Compra One-Off: Stock insuficiente para ${productForUpdate.description}. Se necesita ${quantityChange} adicional, disponible: ${stockDisponible}.`);
                    }
                }

                const dataToUpdate: Prisma.one_off_purchaseUpdateInput = {
                    product: { connect: { product_id: firstItem.product_id } },
                    quantity: newQuantity,
                    price_list: { connect: { price_list_id: priceListId } },
                    // person_id ya no se actualiza en este flujo
                    ...(updateDto.sale_channel_id && { sale_channel: { connect: { sale_channel_id: updateDto.sale_channel_id } } }),
                    ...(updateDto.locality_id !== undefined && { 
                        locality: updateDto.locality_id === null 
                            ? { disconnect: true } 
                            : { connect: { locality_id: updateDto.locality_id } } 
                    }),
                    ...(updateDto.zone_id !== undefined && { 
                        zone: updateDto.zone_id === null 
                            ? { disconnect: true } 
                            : { connect: { zone_id: updateDto.zone_id } } 
                    }),
                    purchase_date: updateDto.purchase_date ? new Date(updateDto.purchase_date) : existingPurchase.purchase_date,
                    ...(updateDto.scheduled_delivery_date !== undefined && { 
                        scheduled_delivery_date: updateDto.scheduled_delivery_date ? new Date(updateDto.scheduled_delivery_date) : null 
                    }),
                    ...(updateDto.delivery_time !== undefined && { delivery_time: updateDto.delivery_time }),
                    ...(updateDto.paid_amount !== undefined && { paid_amount: updateDto.paid_amount ? new Decimal(updateDto.paid_amount) : new Decimal(0) }),
                    ...(updateDto.notes !== undefined && { notes: updateDto.notes }),
                    total_amount: newTotalAmount,
                };

                // Filtrar undefined para no sobreescribir con null innecesariamente
                Object.keys(dataToUpdate).forEach(key => (dataToUpdate as any)[key] === undefined && delete (dataToUpdate as any)[key]);

                const updatedPurchase = await prismaTx.one_off_purchase.update({
                    where: { purchase_id: id },
                    data: dataToUpdate,
                    include: { product: true, person: true, sale_channel: true, locality: true, zone: true, price_list: true },
                });

                if (!productForUpdate.is_returnable && quantityChange !== 0) {
                    const movementTypeId = quantityChange > 0 ? 
                        await this.inventoryService.getMovementTypeIdByCode(BUSINESS_CONFIG.MOVEMENT_TYPES.EGRESO_VENTA_UNICA, prismaTx) :
                        await this.inventoryService.getMovementTypeIdByCode(BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_DEVOLUCION_VENTA_UNICA_CANCELADA, prismaTx);

                    const stockMovement: CreateStockMovementDto = {
                        movement_type_id: movementTypeId,
                        product_id: productForUpdate.product_id,
                        quantity: Math.abs(quantityChange),
                        ...(quantityChange > 0 ? {
                            source_warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                        } : {
                            destination_warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                        }),
                        movement_date: new Date(),
                        remarks: `Compra One-Off #${id} ACTUALIZADA - ${productForUpdate.description} (${quantityChange > 0 ? 'Venta' : 'Devolución'})`,
                    };
                    await this.inventoryService.createStockMovement(stockMovement, prismaTx);
                }

                return this.mapToOneOffPurchaseResponseDto(updatedPurchase);
            });
        } catch (error) {
            handlePrismaError(error, 'Compra One-Off');
            if (!(error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException || error instanceof InternalServerErrorException)) {
                throw new InternalServerErrorException(`Error no manejado al actualizar compra one-off`);
            }
            throw error;
        }
    }

    async removeOneOff(id: number): Promise<{ message: string; deleted: boolean }> {
        try {
            const purchase = await this.one_off_purchase.findUniqueOrThrow({
                where: { purchase_id: id },
                include: { product: true }
            }).catch(() => { throw new NotFoundException(`Compra One-Off con ID ${id} no encontrada.`); });

            await this.$transaction(async (prismaTx) => {
                // Renovar stock usando la función unificada
                await this.renewStockForNonReturnableProducts(
                    [{ 
                        product_id: purchase.product_id, 
                        quantity: purchase.quantity, 
                        product: purchase.product 
                    }],
                    `Compra One-Off #${id}`,
                    prismaTx
                );

                // Eliminar la compra
                await prismaTx.one_off_purchase.delete({
                    where: { purchase_id: id }
                });
            });

            return { 
                message: `Compra One-Off con ID ${id} eliminada exitosamente. El stock de productos no retornables ha sido renovado.`, 
                deleted: true 
            };
        } catch (error) {
            handlePrismaError(error, 'Compra One-Off');
            if (!(error instanceof NotFoundException || error instanceof InternalServerErrorException)) {
                throw new InternalServerErrorException(`Error no manejado al eliminar compra one-off`);
            }
            throw error;
        }
    }
    
    // ===== ONE-OFF PURCHASES METHODS =====
    private async renewStockForNonReturnableProducts(
        items: Array<{ product_id: number; quantity: number; product: { is_returnable: boolean; description: string } }>,
        purchaseReference: string,
        prismaTx: any
    ): Promise<void> {
        const returnMovementTypeId = await this.inventoryService.getMovementTypeIdByCode(
            BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_DEVOLUCION_VENTA_UNICA_CANCELADA,
            prismaTx
        );

        for (const item of items) {
            if (item.quantity > 0 && !item.product.is_returnable) {
                await this.inventoryService.createStockMovement({
                    movement_type_id: returnMovementTypeId,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    source_warehouse_id: null,
                    destination_warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                    movement_date: new Date(),
                    remarks: `${purchaseReference} CANCELADA - Devolución producto no retornable ${item.product.description} (ID ${item.product_id})`,
                }, prismaTx);
            }
        }
    }

    private groupPurchasesByOrder(purchases: any[]): Map<string, any[]> {
        const grouped = new Map<string, any[]>();
        
        for (const purchase of purchases) {
            // Agrupar por person_id y fecha de compra (mismo día)
            const purchaseDate = new Date(purchase.purchase_date);
            const dateKey = purchaseDate.toISOString().split('T')[0]; // Solo fecha, sin hora
            const groupKey = `${purchase.person_id}-${dateKey}`;
            
            if (!grouped.has(groupKey)) {
                grouped.set(groupKey, []);
            }
            grouped.get(groupKey)!.push(purchase);
        }
        
        return grouped;
    }

    private mapToConsolidatedOneOffPurchaseResponseDto(purchases: any[]): OneOffPurchaseResponseDto {
        if (!purchases || purchases.length === 0) {
            throw new BadRequestException('No hay compras para consolidar');
        }
        // Usar la primera compra como base para los datos comunes
        const basePurchase = purchases[0];
        
        // Calcular el total consolidado
        const totalAmount = purchases.reduce((sum, purchase) => 
            sum.add(purchase.total_amount), new Decimal(0)
        );

        // Consolidar todos los productos
        const products = purchases.map(purchase => ({
            product_id: purchase.product.product_id,
            description: purchase.product.description,
            quantity: purchase.quantity,
            price_list: purchase.price_list 
                ? {
                    price_list_id: purchase.price_list.price_list_id,
                    name: purchase.price_list.name,
                    unit_price: (purchase.total_amount.div(purchase.quantity)).toString()
                }
                : undefined
        }));

        return {
            purchase_id: basePurchase.purchase_id,
            person_id: basePurchase.person_id,
            purchase_date: basePurchase.purchase_date.toISOString(),
            scheduled_delivery_date: basePurchase.scheduled_delivery_date?.toISOString(),
            delivery_time: basePurchase.delivery_time,
            total_amount: totalAmount.toString(),
            paid_amount: basePurchase.paid_amount.toString(),
            notes: basePurchase.notes,
            person: {
                person_id: basePurchase.person.person_id,
                name: basePurchase.person.name || 'Nombre no disponible'
            },
            products: products,
            sale_channel: {
                sale_channel_id: basePurchase.sale_channel.sale_channel_id,
                name: basePurchase.sale_channel.description || 'Canal no disponible'
            },
            locality: basePurchase.locality ? {
                locality_id: basePurchase.locality.locality_id,
                name: basePurchase.locality.name
            } : undefined,
            zone: basePurchase.zone ? {
                zone_id: basePurchase.zone.zone_id,
                name: basePurchase.zone.name
            } : undefined
        };
    }

    private mapToOneOffPurchaseResponseDto(purchase: any): OneOffPurchaseResponseDto {
        return {
            purchase_id: purchase.purchase_id,
            person_id: purchase.person_id,
            purchase_date: purchase.purchase_date.toISOString(),
            scheduled_delivery_date: purchase.scheduled_delivery_date?.toISOString(),
            delivery_time: purchase.delivery_time,
            total_amount: purchase.total_amount.toString(),
            paid_amount: purchase.paid_amount.toString(),
            notes: purchase.notes,
            person: {
                person_id: purchase.person.person_id,
                name: purchase.person.name || 'Nombre no disponible'
            },
            products: [{
                product_id: purchase.product.product_id,
                description: purchase.product.description,
                quantity: purchase.quantity,
                price_list: purchase.price_list 
                    ? {
                        price_list_id: purchase.price_list.price_list_id,
                        name: purchase.price_list.name,
                        unit_price: (purchase.total_amount.div(purchase.quantity)).toString()
                    }
                    : undefined
            }],
            sale_channel: {
                sale_channel_id: purchase.sale_channel.sale_channel_id,
                name: purchase.sale_channel.description || 'Canal no disponible'
            },
            locality: purchase.locality ? {
                locality_id: purchase.locality.locality_id,
                name: purchase.locality.name
            } : undefined,
            zone: purchase.zone ? {
                zone_id: purchase.zone.zone_id,
                name: purchase.zone.name
            } : undefined
        };
    }

    private async validateOneOffPurchaseData(dto: CreateOneOffPurchaseDto | UpdateOneOffPurchaseDto, tx?: Prisma.TransactionClient) {
        const prisma = tx || this;

        // Validar que hay items
        if (!dto.items || dto.items.length === 0) {
            throw new BadRequestException('Debe especificar al menos un producto en la compra.');
        }

        // Validar productos por item
        for (const item of dto.items) {
            const product = await prisma.product.findUnique({ where: { product_id: item.product_id } });
            if (!product) throw new NotFoundException(`Producto con ID ${item.product_id} no encontrado.`);
        }

        // Validar canal de venta
        const saleChannel = await prisma.sale_channel.findUnique({ where: { sale_channel_id: dto.sale_channel_id } });
        if (!saleChannel) throw new NotFoundException(`Canal de venta con ID ${dto.sale_channel_id} no encontrado.`);

        // Validar localidad si se especifica
        if (dto.locality_id) {
            const locality = await prisma.locality.findUnique({ where: { locality_id: dto.locality_id } });
            if (!locality) throw new NotFoundException(`Localidad con ID ${dto.locality_id} no encontrada.`);
        }

        // Validar zona si se especifica
        if (dto.zone_id) {
            const zone = await prisma.zone.findUnique({ where: { zone_id: dto.zone_id } });
            if (!zone) throw new NotFoundException(`Zona con ID ${dto.zone_id} no encontrada.`);
        }
    }

}