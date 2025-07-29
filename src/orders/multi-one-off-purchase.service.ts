import { Injectable, NotFoundException, OnModuleInit, InternalServerErrorException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma, one_off_purchase_header as OneOffPurchaseHeaderPrisma, one_off_purchase_item as OneOffPurchaseItemPrisma, product as ProductPrisma, person as PersonPrisma, sale_channel as SaleChannelPrisma, locality as LocalityPrisma, zone as ZonePrisma, price_list as PriceListPrisma } from '@prisma/client';
import { CreateMultiOneOffPurchaseDto } from './dto/create-multi-one-off-purchase.dto';
import { FilterMultiOneOffPurchasesDto } from './dto/filter-multi-one-off-purchases.dto';
import { MultiOneOffPurchaseResponseDto, MultiOneOffPurchaseItemResponseDto } from './dto/multi-one-off-purchase-response.dto';
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
                await this.validatePurchaseData(createDto, prismaTx);

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
                        person: { connect: { person_id: createDto.person_id } },
                        sale_channel: { connect: { sale_channel_id: createDto.sale_channel_id } },
                        purchase_date: createDto.purchase_date ? new Date(createDto.purchase_date) : new Date(),
                        total_amount: totalAmount,
                        paid_amount: new Decimal(createDto.paid_amount || '0.00'),
                        delivery_address: createDto.delivery_address,
                        ...(createDto.locality_id && { locality: { connect: { locality_id: createDto.locality_id } } }),
                        ...(createDto.zone_id && { zone: { connect: { zone_id: createDto.zone_id } } }),
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

        // Filtros de fecha
        if (purchaseDateFrom || purchaseDateTo) {
            where.purchase_date = {};
            if (purchaseDateFrom) where.purchase_date.gte = new Date(purchaseDateFrom);
            if (purchaseDateTo) {
                const toDate = new Date(purchaseDateTo);
                toDate.setHours(23, 59, 59, 999);
                where.purchase_date.lte = toDate;
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
} 