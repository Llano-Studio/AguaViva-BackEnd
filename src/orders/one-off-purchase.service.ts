import { Injectable, NotFoundException, OnModuleInit, InternalServerErrorException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma, one_off_purchase as OneOffPurchasePrisma, product as ProductPrisma, person as PersonPrisma, sale_channel as SaleChannelPrisma, locality as LocalityPrisma, zone as ZonePrisma, movement_type as MovementTypePrisma } from '@prisma/client';
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
    private readonly entityName = 'Compra de Única Vez';

    constructor(private readonly inventoryService: InventoryService) {
        super();
    }

    async onModuleInit() {
        await this.$connect();
    }

    private mapToOneOffPurchaseResponseDto(purchase: Prisma.one_off_purchaseGetPayload<{
        include: {
            product: true;
            person: true;
            sale_channel: true;
            locality: true;
            zone: true;
        }
    }>): OneOffPurchaseResponseDto {
        return {
            purchase_id: purchase.purchase_id,
            product_id: purchase.product_id,
            person_id: purchase.person_id,
            quantity: purchase.quantity,
            sale_channel_id: purchase.sale_channel_id,
            locality_id: purchase.locality_id ?? undefined,
            zone_id: purchase.zone_id ?? undefined,
            purchase_date: purchase.purchase_date.toISOString(),
            total_amount: purchase.total_amount.toString(),
            product: purchase.product ? { 
                product_id: purchase.product.product_id, 
                description: purchase.product.description, 
                price: purchase.product.price.toString() 
            } : { product_id: 0, description: 'Producto no disponible', price: '0'}, 
            person: purchase.person ? { 
                person_id: purchase.person.person_id, 
                name: purchase.person.name || 'Persona no disponible' 
            } : { person_id: 0, name: 'Persona no disponible'},
            sale_channel: purchase.sale_channel ? { 
                sale_channel_id: purchase.sale_channel.sale_channel_id, 
                name: purchase.sale_channel.description || 'Canal no disponible' 
            } : { sale_channel_id: 0, name: 'Canal no disponible'}, 
            locality: purchase.locality ? { 
                locality_id: purchase.locality.locality_id, 
                name: purchase.locality.name || '' 
            } : undefined,
            zone: purchase.zone ? { 
                zone_id: purchase.zone.zone_id, 
                name: purchase.zone.name || '' 
            } : undefined,
        };
    }

    private async validatePurchaseData(dto: CreateOneOffPurchaseDto | UpdateOneOffPurchaseDto, tx?: Prisma.TransactionClient) {
        const prisma = tx || this;

        // Validar productos si hay items
        if (dto.items && dto.items.length > 0) {
            for (const item of dto.items) {
                const product = await prisma.product.findUnique({ where: { product_id: item.product_id } });
                if (!product) throw new NotFoundException(`Producto con ID ${item.product_id} no encontrado.`);
            }
        }

        if (dto.person_id) {
            const person = await prisma.person.findUnique({ where: { person_id: dto.person_id } });
            if (!person) throw new NotFoundException(`Persona con ID ${dto.person_id} no encontrada.`);
        }

        const saleChannel = await prisma.sale_channel.findUnique({ where: { sale_channel_id: dto.sale_channel_id } });
        if (!saleChannel) throw new NotFoundException(`Canal de venta con ID ${dto.sale_channel_id} no encontrado.`);

        if (dto.locality_id) {
            const locality = await prisma.locality.findUnique({ where: { locality_id: dto.locality_id } });
            if (!locality) throw new NotFoundException(`Localidad con ID ${dto.locality_id} no encontrada.`);
        }

        if (dto.zone_id) {
            const zone = await prisma.zone.findUnique({ where: { zone_id: dto.zone_id } });
            if (!zone) throw new NotFoundException(`Zona con ID ${dto.zone_id} no encontrada.`);
        }

        if (dto.price_list_id) {
            const priceList = await prisma.price_list.findUnique({ where: { price_list_id: dto.price_list_id } });
            if (!priceList) throw new NotFoundException(`Lista de precios con ID ${dto.price_list_id} no encontrada.`);
        }
    }

    async create(createDto: CreateOneOffPurchaseDto): Promise<OneOffPurchaseResponseDto> {
        try {
            return await this.$transaction(async (prismaTx) => {
                await this.validatePurchaseData(createDto, prismaTx);

                if (!createDto.items || createDto.items.length === 0) {
                    throw new BadRequestException('Debe especificar al menos un producto en la compra.');
                }

                // Determinar la lista de precios a usar
                const priceListId = createDto.price_list_id || BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID;
                
                let totalAmount = new Decimal(0);
                
                // Solo tomamos el primer item para mantener compatibilidad con la estructura actual de one_off_purchase
                // TODO: En el futuro, considerar crear una nueva tabla para one_off_purchase_items
                const firstItem = createDto.items[0];
                const product = await prismaTx.product.findUniqueOrThrow({ where: { product_id: firstItem.product_id } });
                
                // Buscar precio en la lista seleccionada, si no existe usar precio base
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
                
                totalAmount = itemPrice.mul(firstItem.quantity);

                if (!product.is_returnable) {
                    const stockDisponible = await this.inventoryService.getProductStock(firstItem.product_id, BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID, prismaTx);
                    if (stockDisponible < firstItem.quantity) {
                        throw new BadRequestException(
                            `${this.entityName}: Stock insuficiente para ${product.description}. Disponible: ${stockDisponible}, Solicitado: ${firstItem.quantity}.`
                        );
                    }
                }

                const newPurchase = await prismaTx.one_off_purchase.create({
                    data: {
                        person: { connect: { person_id: createDto.person_id } },
                        product: { connect: { product_id: firstItem.product_id } },
                        quantity: firstItem.quantity,
                        sale_channel: { connect: { sale_channel_id: createDto.sale_channel_id } },
                        delivery_address: createDto.delivery_address,
                        ...(createDto.locality_id && { locality: { connect: { locality_id: createDto.locality_id } } }),
                        ...(createDto.zone_id && { zone: { connect: { zone_id: createDto.zone_id } } }),
                        purchase_date: createDto.purchase_date ? new Date(createDto.purchase_date) : new Date(),
                        total_amount: totalAmount.toString(),
                    },
                    include: { product: true, person: true, sale_channel: true, locality: true, zone: true },
                });

                if (!product.is_returnable) {
                    const movementTypeId = await this.inventoryService.getMovementTypeIdByCode(BUSINESS_CONFIG.MOVEMENT_TYPES.EGRESO_VENTA_UNICA, prismaTx);
                    const stockMovement: CreateStockMovementDto = {
                        movement_type_id: movementTypeId,
                        product_id: newPurchase.product_id,
                        quantity: newPurchase.quantity,
                        source_warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                        movement_date: new Date(),
                        remarks: `${this.entityName} #${newPurchase.purchase_id} - Producto ${product.description}`,
                    };
                    await this.inventoryService.createStockMovement(stockMovement, prismaTx);
                }

                return this.mapToOneOffPurchaseResponseDto(newPurchase);
            });
        } catch (error) {
            handlePrismaError(error, this.entityName);
            if (!(error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException || error instanceof InternalServerErrorException)) {
                throw new InternalServerErrorException(`Error no manejado al crear ${this.entityName.toLowerCase()}`);
           }
           throw error;
        }
    }

    async findAll(filters: FilterOneOffPurchasesDto): Promise<{ data: OneOffPurchaseResponseDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
        const { search, customerName, productName, page = 1, limit = 10, sortBy, purchaseDateFrom, purchaseDateTo, person_id, product_id, sale_channel_id, locality_id, zone_id } = filters;
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
        // Add other person related direct filters if needed here
        if (Object.keys(personFilter).length > 0) {
            where.person = personFilter;
        }

        const productFilter: Prisma.productWhereInput = {};
        if (productName) {
            productFilter.description = { contains: productName, mode: 'insensitive' };
        }
        // Add other product related direct filters if needed here
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
            handlePrismaError(error, `${this.entityName}s`); // Usar plural para listados
             if (!(error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException || error instanceof InternalServerErrorException)) {
                throw new InternalServerErrorException(`Error no manejado al buscar ${this.entityName.toLowerCase()}s`);
            }
            throw error;
        }
    }

    async findOne(id: number): Promise<OneOffPurchaseResponseDto> {
        try {
            const purchase = await this.one_off_purchase.findUniqueOrThrow({
                where: { purchase_id: id },
                include: { product: true, person: true, sale_channel: true, locality: true, zone: true },
            }).catch(() => { throw new NotFoundException(`${this.entityName} con ID ${id} no encontrada.`); });
            return this.mapToOneOffPurchaseResponseDto(purchase);
        } catch (error) {
            handlePrismaError(error, this.entityName);
             if (!(error instanceof NotFoundException || error instanceof InternalServerErrorException)) {
                throw new InternalServerErrorException(`Error no manejado al buscar ${this.entityName.toLowerCase()} por ID.`);
            }
            throw error;
        }
    }

    async update(id: number, updateDto: UpdateOneOffPurchaseDto): Promise<OneOffPurchaseResponseDto> {
        try {
            return await this.$transaction(async (prismaTx) => {
                const existingPurchase = await prismaTx.one_off_purchase.findUniqueOrThrow({
                    where: { purchase_id: id },
                    include: { product: true }
                }).catch(() => { throw new NotFoundException(`${this.entityName} con ID ${id} no encontrada.`); });

                await this.validatePurchaseData(updateDto, prismaTx);
                
                // Si hay items nuevos, tomamos el primer item para compatibilidad
                // Si no hay items, mantenemos el producto existente
                const productForUpdate = (updateDto.items && updateDto.items.length > 0) ? 
                    await prismaTx.product.findUniqueOrThrow({ where: { product_id: updateDto.items[0].product_id } }) :
                    existingPurchase.product;
                
                const newQuantity = (updateDto.items && updateDto.items.length > 0) ? 
                    updateDto.items[0].quantity : existingPurchase.quantity;
                
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
                        throw new BadRequestException(`${this.entityName}: Stock insuficiente para ${productForUpdate.description}. Se necesita ${quantityChange} adicional, disponible: ${stockDisponible}.`);
                    }
                }

                const dataToUpdate: Prisma.one_off_purchaseUpdateInput = {
                    ...((updateDto.items && updateDto.items.length > 0) && { product: { connect: { product_id: updateDto.items[0].product_id } } }),
                    ...(updateDto.person_id && { person: { connect: { person_id: updateDto.person_id } } }),
                    quantity: newQuantity,
                    ...(updateDto.sale_channel_id && { sale_channel: { connect: { sale_channel_id: updateDto.sale_channel_id } } }),
                    delivery_address: updateDto.delivery_address,
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
                        await this.inventoryService.getMovementTypeIdByCode(BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_DEVOLUCION_VENTA_UNICA, prismaTx);
                    
                    await this.inventoryService.createStockMovement({
                        movement_type_id: movementTypeId,
                        product_id: productForUpdate.product_id,
                        quantity: Math.abs(quantityChange),
                        source_warehouse_id: quantityChange < 0 ? null : BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                        destination_warehouse_id: quantityChange < 0 ? BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID : null,
                        movement_date: new Date(),
                        remarks: `${this.entityName} #${id} - Ajuste producto ${productForUpdate.description}, cantidad: ${quantityChange}`,
                    }, prismaTx);
                }
                return this.mapToOneOffPurchaseResponseDto(updatedPurchase);
            });
        } catch (error) {
            handlePrismaError(error, this.entityName);
            if (!(error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException || error instanceof InternalServerErrorException)) {
                throw new InternalServerErrorException(`Error no manejado al actualizar ${this.entityName.toLowerCase()}`);
            }
            throw error;
        }
    }

    async remove(id: number): Promise<{ message: string; deleted: boolean }> {
        try {
            const purchase = await this.one_off_purchase.findUniqueOrThrow({
                where: { purchase_id: id }, 
                include: { product: true }
            }).catch(() => { throw new NotFoundException(`${this.entityName} con ID ${id} no encontrada.`); });
            
            await this.$transaction(async (prismaTx) => {
                if (purchase.quantity > 0) {
                    const returnMovementTypeId = await this.inventoryService.getMovementTypeIdByCode(BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_DEVOLUCION_VENTA_UNICA_CANCELADA, prismaTx);
                    
                    // Para productos retornables, renovar el stock
                    if (purchase.product.is_returnable) {
                        await this.inventoryService.createStockMovement({
                            movement_type_id: returnMovementTypeId,
                            product_id: purchase.product_id,
                            quantity: purchase.quantity,
                            source_warehouse_id: null, 
                            destination_warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                            movement_date: new Date(),
                            remarks: `${this.entityName} #${id} CANCELADA - Renovación stock producto retornable ${purchase.product.description}`,
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
                            remarks: `${this.entityName} #${id} CANCELADA - Devolución producto ${purchase.product.description}`,
                        }, prismaTx);
                    }
                }
                await prismaTx.one_off_purchase.delete({ where: { purchase_id: id } });
            });
            return { message: `${this.entityName} con ID ${id} eliminada. El stock de productos (retornables y no retornables) ha sido renovado.`, deleted: true };
        } catch (error) {
            handlePrismaError(error, this.entityName);
            if (!(error instanceof NotFoundException || error instanceof InternalServerErrorException)) {
                 throw new InternalServerErrorException(`Error no manejado al eliminar ${this.entityName.toLowerCase()}`);
            }
            throw error;
        }
    }
} 