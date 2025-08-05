import { Injectable, NotFoundException, OnModuleInit, InternalServerErrorException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma, one_off_purchase_header as OneOffPurchaseHeaderPrisma, one_off_purchase_item as OneOffPurchaseItemPrisma, product as ProductPrisma, person as PersonPrisma, sale_channel as SaleChannelPrisma, locality as LocalityPrisma, zone as ZonePrisma, price_list as PriceListPrisma } from '@prisma/client';
import { PersonType } from '../common/constants/enums';
import { CreateMultiOneOffPurchaseDto } from './dto/create-multi-one-off-purchase.dto';
import { FilterMultiOneOffPurchasesDto } from './dto/filter-multi-one-off-purchases.dto';
import { MultiOneOffPurchaseResponseDto } from './dto/multi-one-off-purchase-response.dto';
import { CreateOneOffPurchaseDto } from './dto/create-one-off-purchase.dto';
import { UpdateOneOffPurchaseDto } from './dto/update-one-off-purchase.dto';
import { FilterOneOffPurchasesDto } from './dto/filter-one-off-purchases.dto';
import { OneOffPurchaseResponseDto } from './dto/one-off-purchase-response.dto';
import { CreateOneOffPurchaseWithCustomerDto } from './dto/create-one-off-purchase-with-customer.dto';
import { InventoryService } from '../inventory/inventory.service';
import { CreateStockMovementDto } from '../inventory/dto/create-stock-movement.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { BUSINESS_CONFIG } from '../common/config/business.config';

type OneOffPurchaseHeaderWithRelations = Prisma.one_off_purchase_headerGetPayload<{
    include: {
        person: true;
        sale_channel: true;
        locality: true;
        zone: true;
        purchase_items: {
            include: {
                product: true;
                price_list: true;
            };
        };
    };
}>;

@Injectable()
export class MultiOneOffPurchaseService extends PrismaClient implements OnModuleInit {
    private readonly entityName = 'Compra Múltiple de Una Vez';

    constructor(private readonly inventoryService: InventoryService) {
        super();
    }

    async onModuleInit() {
        await this.$connect();
    }

    private mapToMultiOneOffPurchaseResponseDto(purchase: OneOffPurchaseHeaderWithRelations): MultiOneOffPurchaseResponseDto {
        return {
            purchase_header_id: purchase.purchase_header_id,
            person_id: purchase.person_id,
            sale_channel_id: purchase.sale_channel_id,
            purchase_date: purchase.purchase_date.toISOString(),
            scheduled_delivery_date: purchase.scheduled_delivery_date?.toISOString(),
            total_amount: purchase.total_amount.toString(),
            paid_amount: purchase.paid_amount.toString(),
            delivery_address: purchase.delivery_address || undefined,
            locality_id: purchase.locality_id || undefined,
            zone_id: purchase.zone_id || undefined,
            notes: purchase.notes || undefined,
            status: purchase.status,
            payment_status: purchase.payment_status,
            delivery_status: purchase.delivery_status,
            created_at: purchase.created_at.toISOString(),
            updated_at: purchase.updated_at.toISOString(),
            person: {
                person_id: purchase.person.person_id,
                name: purchase.person.name || 'Nombre no disponible',
                phone: purchase.person.phone,
                tax_id: purchase.person.tax_id || undefined
            },
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
            } : undefined,
            purchase_items: purchase.purchase_items.map(item => ({
                purchase_item_id: item.purchase_item_id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price.toString(),
                subtotal: item.subtotal.toString(),
                price_list_id: item.price_list_id || undefined,
                notes: item.notes || undefined,
                product: {
                    product_id: item.product.product_id,
                    description: item.product.description,
                    price: item.product.price.toString(),
                    is_returnable: item.product.is_returnable
                },
                price_list: item.price_list ? {
                    price_list_id: item.price_list.price_list_id,
                    name: item.price_list.name
                } : undefined
            }))
        };
    }

    private async validatePurchaseData(dto: CreateMultiOneOffPurchaseDto, tx?: Prisma.TransactionClient) {
        const prisma = tx || this;

        // Validar que hay ítems
        if (!dto.items || dto.items.length === 0) {
            throw new BadRequestException('Debe especificar al menos un producto en la compra.');
        }

        // Validar productos y listas de precios por ítem
        for (const item of dto.items) {
            const product = await prisma.product.findUnique({ where: { product_id: item.product_id } });
            if (!product) throw new NotFoundException(`Producto con ID ${item.product_id} no encontrado.`);

            // Validar lista de precios específica del ítem si se especifica
            if (item.price_list_id) {
                const priceList = await prisma.price_list.findUnique({ where: { price_list_id: item.price_list_id } });
                if (!priceList) throw new NotFoundException(`Lista de precios con ID ${item.price_list_id} no encontrada.`);
            }
        }

        // Validar persona
        const person = await prisma.person.findUnique({ where: { person_id: dto.person_id } });
        if (!person) throw new NotFoundException(`Persona con ID ${dto.person_id} no encontrada.`);

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

    async create(createDto: CreateMultiOneOffPurchaseDto): Promise<MultiOneOffPurchaseResponseDto> {
        try {
            return await this.$transaction(async (prismaTx) => {
                // Determinar si es creación con cliente o sin cliente
                let personId: number;
                
                if (createDto.customer) {
                    // Buscar o crear el cliente
                    let person = await prismaTx.person.findFirst({
                        where: { phone: createDto.customer.phone }
                    });

                    if (!person) {
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
                    personId = person.person_id;
                } else if (createDto.person_id) {
                    personId = createDto.person_id;
                } else {
                    throw new BadRequestException('Debe especificar person_id (cliente existente) o customer (cliente nuevo)');
                }

                // Determinar dirección de entrega y locality/zone
                const deliveryAddress = createDto.requires_delivery 
                    ? (createDto.delivery_address || (createDto.customer?.address))
                    : null;

                const deliveryLocalityId = createDto.locality_id || createDto.customer?.localityId;
                const deliveryZoneId = createDto.zone_id || createDto.customer?.zoneId;

                await this.validatePurchaseData({ ...createDto, person_id: personId }, prismaTx);

                let totalAmount = new Decimal(0);
                const itemsData: Prisma.one_off_purchase_itemCreateWithoutPurchase_headerInput[] = [];

                // Calcular precios para cada ítem individualmente
                for (const itemDto of createDto.items) {
                    const product = await prismaTx.product.findUniqueOrThrow({ where: { product_id: itemDto.product_id } });
                    
                    // Determinar qué lista de precios usar para este ítem específico
                    const priceListId = itemDto.price_list_id || BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID;
                    
                    // Buscar precio en la lista específica del ítem
                    let itemPrice = new Decimal(product.price); // Precio base como fallback
                    
                    const priceItem = await prismaTx.price_list_item.findFirst({
                        where: { 
                            price_list_id: priceListId,
                            product_id: itemDto.product_id 
                        }
                    });
                    
                    if (priceItem) {
                        itemPrice = new Decimal(priceItem.unit_price);
                    }
                    
                    const itemSubtotal = itemPrice.mul(itemDto.quantity);
                    totalAmount = totalAmount.plus(itemSubtotal);

                    // Verificar stock para productos no retornables
                    if (!product.is_returnable) {
                        const stockDisponible = await this.inventoryService.getProductStock(
                            itemDto.product_id, 
                            BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID, 
                            prismaTx
                        );
                        if (stockDisponible < itemDto.quantity) {
                            throw new BadRequestException(
                                `${this.entityName}: Stock insuficiente para ${product.description}. Disponible: ${stockDisponible}, Solicitado: ${itemDto.quantity}.`
                            );
                        }
                    }

                    itemsData.push({
                        product: { connect: { product_id: itemDto.product_id } },
                        quantity: itemDto.quantity,
                        unit_price: itemPrice,
                        subtotal: itemSubtotal,
                        ...(itemDto.price_list_id && { price_list: { connect: { price_list_id: itemDto.price_list_id } } }),
                        notes: itemDto.notes
                    });
                }

                // Crear la compra
                const newPurchase = await prismaTx.one_off_purchase_header.create({
                    data: {
                        person: { connect: { person_id: personId } },
                        sale_channel: { connect: { sale_channel_id: createDto.sale_channel_id } },
                        purchase_date: createDto.purchase_date ? new Date(createDto.purchase_date) : new Date(),
                        scheduled_delivery_date: createDto.scheduled_delivery_date ? new Date(createDto.scheduled_delivery_date) : null,
                        total_amount: totalAmount,
                        paid_amount: new Decimal(createDto.paid_amount || '0.00'),
                        delivery_address: deliveryAddress,
                        ...(deliveryLocalityId && { locality: { connect: { locality_id: deliveryLocalityId } } }),
                        ...(deliveryZoneId && { zone: { connect: { zone_id: deliveryZoneId } } }),
                        notes: createDto.notes,
                        status: createDto.status || 'PENDING',
                        payment_status: createDto.payment_status || 'PENDING',
                        delivery_status: createDto.delivery_status || 'PENDING',
                        purchase_items: {
                            create: itemsData
                        }
                    },
                    include: {
                        person: true,
                        sale_channel: true,
                        locality: true,
                        zone: true,
                        purchase_items: {
                            include: {
                                product: true,
                                price_list: true
                            }
                        }
                    }
                });

                // Crear movimientos de stock para productos no retornables
                const saleMovementTypeId = await this.inventoryService.getMovementTypeIdByCode(
                    BUSINESS_CONFIG.MOVEMENT_TYPES.EGRESO_VENTA_UNICA,
                    prismaTx
                );

                for (const item of newPurchase.purchase_items) {
                    const product = item.product;
                    if (!product.is_returnable) {
                        const stockMovement: CreateStockMovementDto = {
                            movement_type_id: saleMovementTypeId,
                            product_id: item.product_id,
                            quantity: item.quantity,
                            source_warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                            movement_date: new Date(),
                            remarks: `${this.entityName} #${newPurchase.purchase_header_id} - ${product.description}`,
                        };
                        await this.inventoryService.createStockMovement(stockMovement, prismaTx);
                    }
                }

                return this.mapToMultiOneOffPurchaseResponseDto(newPurchase);
            });
        } catch (error) {
            handlePrismaError(error, this.entityName);
            if (!(error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException || error instanceof InternalServerErrorException)) {
                throw new InternalServerErrorException(`Error no manejado al crear ${this.entityName.toLowerCase()}`);
           }
           throw error;
        }
    }

    async findAll(filters: FilterMultiOneOffPurchasesDto): Promise<{ data: MultiOneOffPurchaseResponseDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
        const { 
            search, 
            customerName, 
            productName, 
            purchaseDateFrom, 
            purchaseDateTo, 
            deliveryDateFrom,
            deliveryDateTo,
            page = 1, 
            limit = 10, 
            sortBy,
            person_id,
            product_id,
            sale_channel_id,
            locality_id,
            zone_id,
            price_list_id,
            status,
            payment_status,
            delivery_status
        } = filters;

        const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
        const take = Math.max(1, limit);
        const where: Prisma.one_off_purchase_headerWhereInput = {};

        // Filtros directos
        if (person_id) where.person_id = person_id;
        if (sale_channel_id) where.sale_channel_id = sale_channel_id;
        if (locality_id) where.locality_id = locality_id;
        if (zone_id) where.zone_id = zone_id;
        if (status) where.status = status;
        if (payment_status) where.payment_status = payment_status;
        if (delivery_status) where.delivery_status = delivery_status;

        // Filtros por relaciones
        if (customerName) {
            where.person = {
                name: { contains: customerName, mode: 'insensitive' }
            };
        }

        if (productName) {
            where.purchase_items = {
                some: {
                    product: {
                        description: { contains: productName, mode: 'insensitive' }
                    }
                }
            };
        }

        if (product_id) {
            where.purchase_items = {
                some: {
                    product_id: product_id
                }
            };
        }

        // Filtro por lista de precios a nivel de ítem
        if (price_list_id) {
            where.purchase_items = {
                some: {
                    price_list_id: price_list_id
                }
            };
        }

        // Búsqueda general
        if (search) {
            const searchNum = parseInt(search);
            const orConditions: Prisma.one_off_purchase_headerWhereInput[] = [
                { person: { name: { contains: search, mode: 'insensitive' } } },
                { purchase_items: { some: { product: { description: { contains: search, mode: 'insensitive' } } } } },
            ];
            if (!isNaN(searchNum)) {
                orConditions.push({ purchase_header_id: searchNum });
            }
            where.OR = orConditions;
        }

        // Filtros de fecha de compra
        if (purchaseDateFrom || purchaseDateTo) {
            where.purchase_date = {};
            if (purchaseDateFrom) where.purchase_date.gte = new Date(purchaseDateFrom);
            if (purchaseDateTo) {
                const toDate = new Date(purchaseDateTo);
                toDate.setHours(23, 59, 59, 999);
                where.purchase_date.lte = toDate;
            }
        }

        if (deliveryDateFrom || deliveryDateTo) {
            where.scheduled_delivery_date = {};
            if (deliveryDateFrom) where.scheduled_delivery_date.gte = new Date(deliveryDateFrom);
            if (deliveryDateTo) {
                const toDate = new Date(deliveryDateTo);
                toDate.setHours(23, 59, 59, 999);
                where.scheduled_delivery_date.lte = toDate;
            }
        }

        const orderBy = parseSortByString(sortBy, [{ purchase_date: 'desc' }]);

        try {
            const [total, purchases] = await this.$transaction([
                this.one_off_purchase_header.count({ where }),
                this.one_off_purchase_header.findMany({
                    where,
                    include: {
                        person: true,
                        sale_channel: true,
                        locality: true,
                        zone: true,
                        purchase_items: {
                            include: {
                                product: true,
                                price_list: true
                            }
                        }
                    },
                    orderBy,
                    skip,
                    take,
                })
            ]);

            return {
                data: purchases.map(p => this.mapToMultiOneOffPurchaseResponseDto(p)),
                meta: {
                    total,
                    page,
                    limit: take,
                    totalPages: Math.ceil(total / take)
                }
            };
        } catch (error) {
            handlePrismaError(error, `${this.entityName}s`);
            if (!(error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException || error instanceof InternalServerErrorException)) {
                throw new InternalServerErrorException(`Error no manejado al buscar ${this.entityName.toLowerCase()}s`);
            }
            throw error;
        }
    }

    async findOne(id: number): Promise<MultiOneOffPurchaseResponseDto> {
        try {
            const purchase = await this.one_off_purchase_header.findUniqueOrThrow({
                where: { purchase_header_id: id },
                include: {
                    person: true,
                    sale_channel: true,
                    locality: true,
                    zone: true,
                    purchase_items: {
                        include: {
                            product: true,
                            price_list: true
                        }
                    }
                },
            }).catch(() => { throw new NotFoundException(`${this.entityName} con ID ${id} no encontrada.`); });

            return this.mapToMultiOneOffPurchaseResponseDto(purchase);
        } catch (error) {
            handlePrismaError(error, this.entityName);
            if (!(error instanceof NotFoundException || error instanceof InternalServerErrorException)) {
                throw new InternalServerErrorException(`Error no manejado al buscar ${this.entityName.toLowerCase()} por ID.`);
            }
            throw error;
        }
    }

    async remove(id: number): Promise<{ message: string; deleted: boolean }> {
        try {
            const purchase = await this.one_off_purchase_header.findUniqueOrThrow({
                where: { purchase_header_id: id },
                include: {
                    purchase_items: {
                        include: {
                            product: true
                        }
                    }
                }
            }).catch(() => { throw new NotFoundException(`${this.entityName} con ID ${id} no encontrada.`); });

            await this.$transaction(async (prismaTx) => {
                // Crear movimientos de stock para productos retornables
                const returnMovementTypeId = await this.inventoryService.getMovementTypeIdByCode(
                    BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_DEVOLUCION_VENTA_UNICA_CANCELADA,
                    prismaTx
                );

                for (const item of purchase.purchase_items) {
                    if (item.quantity > 0) {
                        // Para productos retornables, renovar el stock
                        if (item.product.is_returnable) {
                            await this.inventoryService.createStockMovement({
                                movement_type_id: returnMovementTypeId,
                                product_id: item.product_id,
                                quantity: item.quantity,
                                source_warehouse_id: null,
                                destination_warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                                movement_date: new Date(),
                                remarks: `${this.entityName} #${id} CANCELADA - Renovación stock producto retornable ${item.product.description} (ID ${item.product_id})`,
                            }, prismaTx);
                        }
                        // Para productos no retornables, mantener la lógica existente
                        else {
                            await this.inventoryService.createStockMovement({
                                movement_type_id: returnMovementTypeId,
                                product_id: item.product_id,
                                quantity: item.quantity,
                                source_warehouse_id: null,
                                destination_warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                                movement_date: new Date(),
                                remarks: `${this.entityName} #${id} CANCELADA - Devolución producto ${item.product.description} (ID ${item.product_id})`,
                            }, prismaTx);
                        }
                    }
                }

                // Eliminar los ítems primero
                await prismaTx.one_off_purchase_item.deleteMany({
                    where: { purchase_header_id: id }
                });

                // Luego eliminar el header
                await prismaTx.one_off_purchase_header.delete({
                    where: { purchase_header_id: id }
                });
            });

            return { 
                message: `${this.entityName} con ID ${id} eliminada. El stock de productos (retornables y no retornables) ha sido renovado.`, 
                deleted: true 
            };
        } catch (error) {
            handlePrismaError(error, this.entityName);
            if (!(error instanceof NotFoundException || error instanceof InternalServerErrorException)) {
                throw new InternalServerErrorException(`Error no manejado al eliminar ${this.entityName.toLowerCase()}`);
            }
            throw error;
        }
    }

    async findAllSimpleOneOff(): Promise<any> {
        try {
            const purchases = await this.one_off_purchase.findMany({
                include: { 
                    product: true, 
                    person: true, 
                    sale_channel: true, 
                    locality: true, 
                    zone: true 
                },
                orderBy: { purchase_date: 'desc' }
            });
            
            return purchases.map(purchase => ({
                purchase_id: purchase.purchase_id,
                person_id: purchase.person_id,
                product_id: purchase.product_id,
                quantity: purchase.quantity,
                sale_channel_id: purchase.sale_channel_id,
                locality_id: purchase.locality_id,
                zone_id: purchase.zone_id,
                purchase_date: purchase.purchase_date.toISOString(),
                total_amount: purchase.total_amount.toString(),
                delivery_address: purchase.delivery_address,
                person: {
                    person_id: purchase.person.person_id,
                    name: purchase.person.name || 'Nombre no disponible',
                    phone: purchase.person.phone,
                    tax_id: purchase.person.tax_id
                },
                product: {
                    product_id: purchase.product.product_id,
                    description: purchase.product.description,
                    price: purchase.product.price.toString()
                },
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

    // ===== ONE-OFF PURCHASES METHODS =====

    private mapToOneOffPurchaseResponseDto(purchase: any): OneOffPurchaseResponseDto {
        return {
            purchase_id: purchase.purchase_id,
            person_id: purchase.person_id,
            product_id: purchase.product_id,
            quantity: purchase.quantity,
            sale_channel_id: purchase.sale_channel_id,
            locality_id: purchase.locality_id,
            zone_id: purchase.zone_id,
            purchase_date: purchase.purchase_date.toISOString(),
            scheduled_delivery_date: purchase.scheduled_delivery_date?.toISOString(),
            total_amount: purchase.total_amount.toString(),
            person: {
                person_id: purchase.person.person_id,
                name: purchase.person.name || 'Nombre no disponible'
            },
            product: {
                product_id: purchase.product.product_id,
                description: purchase.product.description,
                price: purchase.product.price.toString()
            },
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
                const priceListId = createDto.price_list_id || BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID;
                
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
                        person: { connect: { person_id: 0 } }, // Este método ya no se usa, pero mantenemos la estructura
                        product: { connect: { product_id: firstItem.product_id } },
                        quantity: firstItem.quantity,
                        sale_channel: { connect: { sale_channel_id: createDto.sale_channel_id } },
                        delivery_address: createDto.delivery_address,
                        locality: createDto.locality_id ? { connect: { locality_id: createDto.locality_id } } : undefined,
                        zone: createDto.zone_id ? { connect: { zone_id: createDto.zone_id } } : undefined,
                        purchase_date: createDto.purchase_date ? new Date(createDto.purchase_date) : new Date(),
                        scheduled_delivery_date: createDto.scheduled_delivery_date ? new Date(createDto.scheduled_delivery_date) : null,
                        total_amount: totalAmount,
                    },
                    include: { product: true, person: true, sale_channel: true, locality: true, zone: true },
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

                // Tomar el primer item (limitación actual del sistema)
                const firstItem = createDto.items[0];
                const product = await prismaTx.product.findUniqueOrThrow({ where: { product_id: firstItem.product_id } });
                
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

                // Determinar qué lista de precios usar
                const priceListId = createDto.price_list_id || BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID;
                
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

                // Determinar dirección de entrega
                const deliveryAddress = createDto.requires_delivery 
                    ? (createDto.delivery_address || person.address)
                    : null;

                // Determinar localidad y zona para entrega
                const deliveryLocalityId = createDto.locality_id || createDto.customer.localityId || person.locality_id;
                const deliveryZoneId = createDto.zone_id || createDto.customer.zoneId || person.zone_id;

                const newPurchase = await prismaTx.one_off_purchase.create({
                    data: {
                        person: { connect: { person_id: person.person_id } },
                        product: { connect: { product_id: firstItem.product_id } },
                        quantity: firstItem.quantity,
                        sale_channel: { connect: { sale_channel_id: createDto.sale_channel_id } },
                        delivery_address: deliveryAddress,
                        locality: deliveryLocalityId ? { connect: { locality_id: deliveryLocalityId } } : undefined,
                        zone: deliveryZoneId ? { connect: { zone_id: deliveryZoneId } } : undefined,
                        purchase_date: createDto.purchase_date ? new Date(createDto.purchase_date) : new Date(),
                        scheduled_delivery_date: createDto.scheduled_delivery_date ? new Date(createDto.scheduled_delivery_date) : null,
                        total_amount: totalAmount,
                    },
                    include: { product: true, person: true, sale_channel: true, locality: true, zone: true },
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

        if (purchaseDateFrom || purchaseDateTo) {
            where.purchase_date = {};
            if (purchaseDateFrom) where.purchase_date.gte = new Date(purchaseDateFrom);
            if (purchaseDateTo) {
                const toDate = new Date(purchaseDateTo);
                toDate.setHours(23, 59, 59, 999);
                where.purchase_date.lte = toDate;
            }
        }

        // Filtros de fecha de entrega
        if (deliveryDateFrom || deliveryDateTo) {
            where.scheduled_delivery_date = {};
            if (deliveryDateFrom) where.scheduled_delivery_date.gte = new Date(deliveryDateFrom);
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
                include: { product: true, person: true, sale_channel: true, locality: true, zone: true },
                orderBy,
                skip,
                take,
            });
            return {
                data: purchases.map(p => this.mapToOneOffPurchaseResponseDto(p)),
                meta: {
                    total,
                    page,
                    limit: take,
                    totalPages: Math.ceil(total / take)
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
            const purchase = await this.one_off_purchase.findUniqueOrThrow({
                where: { purchase_id: id },
                include: { product: true, person: true, sale_channel: true, locality: true, zone: true },
            }).catch(() => { throw new NotFoundException(`Compra One-Off con ID ${id} no encontrada.`); });
            return this.mapToOneOffPurchaseResponseDto(purchase);
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
                const priceListId = updateDto.price_list_id || BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID;
                
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
                    total_amount: newTotalAmount.toString(),
                };

                // Filtrar undefined para no sobreescribir con null innecesariamente
                Object.keys(dataToUpdate).forEach(key => (dataToUpdate as any)[key] === undefined && delete (dataToUpdate as any)[key]);

                const updatedPurchase = await prismaTx.one_off_purchase.update({
                    where: { purchase_id: id },
                    data: dataToUpdate,
                    include: { product: true, person: true, sale_channel: true, locality: true, zone: true },
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
                // Crear movimiento de stock para productos retornables
                const returnMovementTypeId = await this.inventoryService.getMovementTypeIdByCode(
                    BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_DEVOLUCION_VENTA_UNICA_CANCELADA,
                    prismaTx
                );

                if (purchase.quantity > 0) {
                    // Para productos retornables, renovar el stock
                    if (purchase.product.is_returnable) {
                        await this.inventoryService.createStockMovement({
                            movement_type_id: returnMovementTypeId,
                            product_id: purchase.product_id,
                            quantity: purchase.quantity,
                            source_warehouse_id: null,
                            destination_warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                            movement_date: new Date(),
                            remarks: `Compra One-Off #${id} CANCELADA - Renovación stock producto retornable ${purchase.product.description} (ID ${purchase.product_id})`,
                        }, prismaTx);
                    }
                    // Para productos no retornables, mantener la lógica existente
                    else {
                        await this.inventoryService.createStockMovement({
                            movement_type_id: returnMovementTypeId,
                            product_id: purchase.product_id,
                            quantity: purchase.quantity,
                            source_warehouse_id: null,
                            destination_warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                            movement_date: new Date(),
                            remarks: `Compra One-Off #${id} CANCELADA - Devolución producto ${purchase.product.description} (ID ${purchase.product_id})`,
                        }, prismaTx);
                    }
                }

                // Eliminar la compra
                await prismaTx.one_off_purchase.delete({
                    where: { purchase_id: id }
                });
            });

            return { 
                message: `Compra One-Off con ID ${id} eliminada exitosamente. El stock de productos ha sido renovado.`, 
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
}