import { Injectable, OnModuleInit, InternalServerErrorException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma, price_list as PrismaPriceList, product as ProductPrisma, price_list_item as PriceListItemPrisma, price_list_history as PriceListHistoryPrisma } from '@prisma/client';
import { CreatePriceListDto, UpdatePriceListDto, ApplyPercentageWithReasonDto, PriceHistoryResponseDto, FilterPriceListDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

type PriceListWithRelations = Prisma.price_listGetPayload<{
    include: {
        price_list_item: {
            include: {
                product: true;
            };
        };
    };
}>;

export interface PaginatedPriceListResponse {
    data: PriceListWithRelations[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface PaginatedPriceHistoryResponse {
    data: PriceHistoryResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface PriceListHistoryWithProduct extends PriceListHistoryPrisma {
    price_list_item: PriceListItemPrisma & { product: ProductPrisma };
}

@Injectable()
export class PriceListService extends PrismaClient implements OnModuleInit {
    private readonly entityName = 'Lista de Precios';

    async onModuleInit() {
        await this.$connect();
    }

    async create(createPriceListDto: CreatePriceListDto): Promise<PrismaPriceList> {
        try {
            const data: Prisma.price_listCreateInput = {
                name: createPriceListDto.name,
                effective_date: new Date(createPriceListDto.effective_date), 
            };
            return await this.price_list.create({
                data
            });
        } catch (error) {
            handlePrismaError(error, this.entityName);
            throw new InternalServerErrorException(`Error no manejado al crear ${this.entityName.toLowerCase()}.`);
        }
    }

    async findAll(filterDto: FilterPriceListDto): Promise<PaginatedPriceListResponse> {
        const { page = 1, limit = 10, sortBy, search, name } = filterDto;
        try {
            const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
            const take = Math.max(1, limit);
            const orderByClause = parseSortByString(sortBy, [{ name: 'asc' }]);

            const where: Prisma.price_listWhereInput = {};
            
            // Búsqueda general en múltiples campos
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } }
                ];
            }
            
            // Filtros específicos
            if (name) {
                where.name = { contains: name, mode: 'insensitive' };
            }

            const [priceLists, totalItems] = await this.$transaction([
                this.price_list.findMany({
                    where,
                    include: {
                        price_list_item: {
                            include: {
                                product: true,
                            },
                        },
                    },
                    orderBy: orderByClause,
                    skip,
                    take,
                }),
                this.price_list.count({ where })
            ]);

            return {
                data: priceLists,
                total: totalItems,
                page,
                limit,
                totalPages: Math.ceil(totalItems / take)
            };
        } catch (error) {
            handlePrismaError(error, `${this.entityName}s`);
            throw new InternalServerErrorException(`Error no manejado al buscar ${this.entityName.toLowerCase()}s.`);
        }
    }

    async findOne(id: number): Promise<PriceListWithRelations> {
        const priceList = await this.price_list.findUnique({
            where: { price_list_id: id },
            include: {
                price_list_item: {
                    include: {
                        product: true,
                    },
                },
            },
        });
        if (!priceList) {
            throw new NotFoundException(`${this.entityName} con ID ${id} no encontrada.`);
        }
        return priceList;
    }

    async update(id: number, updatePriceListDto: UpdatePriceListDto): Promise<PrismaPriceList> {
        await this.findOne(id); // Verifica existencia
        const data: Prisma.price_listUpdateInput = {};
        if (updatePriceListDto.name) data.name = updatePriceListDto.name;
        if (updatePriceListDto.effective_date) data.effective_date = new Date(updatePriceListDto.effective_date);

        if (Object.keys(data).length === 0) {
           return this.price_list.findUniqueOrThrow({ where: {price_list_id: id}});
        }
        try {
            return await this.price_list.update({
                where: { price_list_id: id },
                data,
            });
        } catch (error) {
            handlePrismaError(error, this.entityName);
            throw new InternalServerErrorException(`Error no manejado al actualizar ${this.entityName.toLowerCase()} con ID ${id}.`);
        }
    }

    async remove(id: number): Promise<{ message: string; deleted: boolean }> {
        await this.findOne(id); // Verifica existencia
        try {
            // Eliminar items primero para evitar errores de FK si la relación es restrictiva en DB
            await this.price_list_item.deleteMany({ where: { price_list_id: id } }); 
            await this.price_list.delete({ where: { price_list_id: id } });
            return { message: `${this.entityName} y sus ítems asociados eliminados correctamente`, deleted: true };
        } catch (error) {
            handlePrismaError(error, this.entityName);
            throw new InternalServerErrorException(`Error no manejado al eliminar ${this.entityName.toLowerCase()} con ID ${id}.`);
        }
    }

    async applyPercentageChange(priceListId: number, dto: ApplyPercentageWithReasonDto): Promise<{updated_count: number, message: string}> {
        const priceList: PriceListWithRelations = await this.findOne(priceListId);
        const { percentage, reason, createdBy } = dto;

        if (!priceList.price_list_item || priceList.price_list_item.length === 0) {
            throw new BadRequestException(`La ${this.entityName.toLowerCase()} no tiene ítems para actualizar.`);
        }
        if (typeof percentage !== 'number' || isNaN(percentage) || percentage < -100 || percentage > 1000) {
            throw new BadRequestException('El porcentaje debe ser un número entre -100 y 1000.');
        }
        let updatedCount = 0;
        try {
            await this.$transaction(async (prisma) => {
                for (const item of priceList.price_list_item) {
                    const currentPrice = new Decimal(item.unit_price);
                    let newPrice = currentPrice.mul(new Decimal(1).plus(new Decimal(percentage).div(100)));
                    newPrice = newPrice.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                    if (newPrice.isNegative()) {
                        throw new BadRequestException(`Aplicar un ${percentage}% al ítem ${item.product.description} resulta en un precio negativo.`);
                    }
                    await prisma.price_list_history.create({
                        data: {
                            price_list_item_id: item.price_list_item_id,
                            previous_price: currentPrice,
                            new_price: newPrice,
                            change_percentage: new Decimal(percentage),
                            change_reason: reason || `Cambio por ${percentage}%`,
                            created_by: createdBy
                        }
                    });
                    await prisma.price_list_item.update({
                        where: { price_list_item_id: item.price_list_item_id },
                        data: { unit_price: newPrice }
                    });
                    updatedCount++;
                }
            });
            return {
                updated_count: updatedCount,
                message: `Se aplicó un cambio de ${percentage}% a ${updatedCount} ítems.`
            };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            handlePrismaError(error, this.entityName);
            throw new InternalServerErrorException(`Error no manejado al aplicar porcentaje a ${this.entityName.toLowerCase()} con ID ${priceListId}.`);
        }
    }

    async getPriceHistoryByItemId(priceListItemId: number, paginationDto: PaginationQueryDto): Promise<PaginatedPriceHistoryResponse> {
        const { page = 1, limit = 10, sortBy } = paginationDto;
        const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
        const take = Math.max(1, limit);
        const orderBy = parseSortByString(sortBy, [{ change_date: 'desc' }]);
        try {
            const item = await this.price_list_item.findUnique({ where: { price_list_item_id: priceListItemId } });
            if (!item) throw new NotFoundException(`Ítem de lista de precios con ID ${priceListItemId} no encontrado.`);

            const whereCondition = { price_list_item_id: priceListItemId };
            const [historyItems, totalItems] = await this.$transaction([
                this.price_list_history.findMany({
                    where: whereCondition,
                    orderBy,
                    skip,
                    take,
                    include: { price_list_item: { include: { product: true } } }
                }),
                this.price_list_history.count({ where: whereCondition })
            ]);
            return {
                data: historyItems.map(h => this.toPriceHistoryResponseDto(h as PriceListHistoryWithProduct)),
                total: totalItems, page, limit, totalPages: Math.ceil(totalItems / take)
            };
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            handlePrismaError(error, `historial del ítem ID ${priceListItemId}`);
            throw new InternalServerErrorException(`Error no manejado al obtener historial del ítem ID ${priceListItemId}.`);
        }
    }

    async getPriceHistoryByPriceListId(priceListId: number, paginationDto: PaginationQueryDto): Promise<PaginatedPriceHistoryResponse> {
        const { page = 1, limit = 10, sortBy } = paginationDto;
        const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
        const take = Math.max(1, limit);
        const orderBy = parseSortByString(sortBy, [{ change_date: 'desc' }]);
        try {
            await this.findOne(priceListId); // Verifica existencia
            const itemsInList = await this.price_list_item.findMany({ where: { price_list_id: priceListId }, select: { price_list_item_id: true } });
            if (itemsInList.length === 0) return { data: [], total: 0, page, limit, totalPages: 0 };
            const itemIds = itemsInList.map(item => item.price_list_item_id);

            const whereCondition = { price_list_item_id: { in: itemIds } };
            const [historyItems, totalItems] = await this.$transaction([
                this.price_list_history.findMany({
                    where: whereCondition,
                    orderBy,
                    skip,
                    take,
                    include: { price_list_item: { include: { product: true } } }
                }),
                this.price_list_history.count({ where: whereCondition })
            ]);
            return {
                data: historyItems.map(h => this.toPriceHistoryResponseDto(h as PriceListHistoryWithProduct)),
                total: totalItems, page, limit, totalPages: Math.ceil(totalItems / take)
            };
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            handlePrismaError(error, `historial de la lista ID ${priceListId}`);
            throw new InternalServerErrorException(`Error no manejado al obtener historial de la lista ID ${priceListId}.`);
        }
    }

    private toPriceHistoryResponseDto(historyItem: PriceListHistoryWithProduct): PriceHistoryResponseDto {
        return {
            history_id: historyItem.history_id,
            price_list_item_id: historyItem.price_list_item.price_list_item_id, // Corregido para usar el id del item desde la relación
            product_id: historyItem.price_list_item.product_id,
            product_name: historyItem.price_list_item.product.description, 
            previous_price: historyItem.previous_price.toString(), // Convertir a string
            new_price: historyItem.new_price.toString(), // Convertir a string
            change_date: historyItem.change_date.toISOString(), // Asegurar formato ISO string
            change_percentage: historyItem.change_percentage?.toString(), // Convertir a string si existe
            change_reason: historyItem.change_reason || undefined,
            created_by: historyItem.created_by || undefined,
        };
    }
} 