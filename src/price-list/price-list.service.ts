import { Injectable, OnModuleInit, InternalServerErrorException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma, price_list as PrismaPriceList, product, price_list_item, price_list_history } from '@prisma/client';
import { CreatePriceListDto, UpdatePriceListDto, ApplyPercentageWithReasonDto, PriceHistoryResponseDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';

type PriceListWithItemsAndProducts = Prisma.price_listGetPayload<{
    include: {
        price_list_item: {
            include: {
                product: true;
            };
        };
    };
}>;

@Injectable()
export class PriceListService extends PrismaClient implements OnModuleInit {
    async onModuleInit() {
        await this.$connect();
    }

    async create(createPriceListDto: CreatePriceListDto): Promise<PrismaPriceList> {
        try {
            return await this.price_list.create({
                data: {
                    ...createPriceListDto,
                    effective_date: new Date(createPriceListDto.effective_date),
                },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    throw new ConflictException('Ya existe una lista de precios con alguna propiedad única (ej. nombre).');
                }
            }
            throw new InternalServerErrorException('Error al crear la lista de precios.');
        }
    }

    async findAll(): Promise<PriceListWithItemsAndProducts[]> {
        try {
            return await this.price_list.findMany({
                include: {
                    price_list_item: {
                        include: {
                            product: true,
                        },
                    },
                },
            });
        } catch (error) {
            throw new InternalServerErrorException('Error al obtener las listas de precios.');
        }
    }

    async findOne(id: number): Promise<PriceListWithItemsAndProducts> {
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
            throw new NotFoundException(`Lista de precios con ID ${id} no encontrada.`);
        }
        return priceList;
    }

    async update(id: number, updatePriceListDto: UpdatePriceListDto): Promise<PrismaPriceList> {
        await this.findOne(id);
        const data: Prisma.price_listUpdateInput = {};


        if (updatePriceListDto.name) {
            data.name = updatePriceListDto.name;
        }
        if (updatePriceListDto.effective_date) {
            data.effective_date = new Date(updatePriceListDto.effective_date);
        }

        if (Object.keys(data).length === 0) {
            throw new BadRequestException("No se proporcionaron datos para actualizar.");
        }

        try {
            return await this.price_list.update({
                where: {
                    price_list_id: id
                },
                data,
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    throw new ConflictException('Error al actualizar la lista de precios, alguna propiedad única ya está en uso (ej. nombre).');
                }
            }
            throw new InternalServerErrorException(`Error al actualizar la lista de precios con ID ${id}.`);
        }
    }

    async remove(id: number): Promise<{ message: string; deleted: boolean }> {
        await this.findOne(id);
        try {
            await this.price_list.delete(
                {
                    where: {
                        price_list_id: id
                    }
                });
            return { message: 'Lista de precios eliminada correctamente', deleted: true };
        } catch (error: any) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2003') { // Foreign key constraint violation
                    throw new BadRequestException('No se puede eliminar la lista de precios porque tiene items asociados. Elimine los items primero.');
                }
            }
            throw new InternalServerErrorException(`Error al eliminar la lista de precios con ID ${id}.`);
        }
    }

    async applyPercentageChange(priceListId: number, dto: ApplyPercentageWithReasonDto): Promise<price_list_item[]> {
        const priceList: PriceListWithItemsAndProducts = await this.findOne(priceListId);
        const { percentage, reason, createdBy } = dto;

        if (!priceList.price_list_item || priceList.price_list_item.length === 0) {
            throw new BadRequestException('La lista de precios no tiene ítems para actualizar.');
        }

        // Validación mejorada para el porcentaje
        if (typeof percentage !== 'number' || isNaN(percentage)) {
            throw new BadRequestException('El porcentaje debe ser un número válido.');
        }

        if (percentage > 1000) {
            throw new BadRequestException('El porcentaje de aumento no puede ser mayor al 1000%.');
        }

        if (percentage < -100) {
            throw new BadRequestException('El porcentaje de descuento no puede ser menor a -100%.');
        }

        const updatedItems: price_list_item[] = [];

        try {
            await this.$transaction(async (prisma) => {
                for (const item of priceList.price_list_item) {
                    const currentPrice = new Decimal(item.unit_price);
                    let newPrice = currentPrice.mul(new Decimal(1).plus(new Decimal(percentage).div(100)));

                    // Redondear a 2 decimales (ajustar según las reglas de negocio)
                    newPrice = newPrice.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

                    if (newPrice.isNegative()) {
                        throw new BadRequestException(`Aplicar un ${percentage}% al ítem ${item.price_list_item_id} (producto ${item.product_id}) resulta en un precio negativo: ${newPrice}.`);
                    }

                    // Registrar en el historial antes de actualizar
                    await prisma.price_list_history.create({
                        data: {
                            price_list_item_id: item.price_list_item_id,
                            previous_price: currentPrice,
                            new_price: newPrice,
                            change_percentage: new Decimal(percentage),
                            change_reason: reason || `Cambio de precio por ajuste de ${percentage}%`,
                            created_by: createdBy
                        }
                    });

                    const updatedItem = await prisma.price_list_item.update({
                        where: {
                            price_list_item_id: item.price_list_item_id
                        },
                        data: {
                            unit_price: newPrice
                        },
                        include: {
                            product: true,
                            price_list: true
                        }
                    });
                    updatedItems.push(updatedItem);
                }
            });
            return updatedItems;
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }

            throw new InternalServerErrorException(`Error al aplicar el cambio de porcentaje a la lista de precios con ID ${priceListId}.`);
        }
    }

    /**
     * Obtiene el historial de cambios de precio para un item de lista de precios específico
     */
    async getPriceHistory(priceListItemId: number): Promise<PriceHistoryResponseDto[]> {
        try {
            // Verificar si el item existe
            const item = await this.price_list_item.findUnique({
                where: { price_list_item_id: priceListItemId }
            });

            if (!item) {
                throw new NotFoundException(`Item de lista de precios con ID ${priceListItemId} no encontrado.`);
            }

            // Obtener el historial
            const historyItems = await this.price_list_history.findMany({
                where: { price_list_item_id: priceListItemId },
                orderBy: { change_date: 'desc' }
            });

            // Mapear a DTO
            return historyItems.map(item => new PriceHistoryResponseDto({
                history_id: item.history_id,
                price_list_item_id: item.price_list_item_id,
                previous_price: item.previous_price.toString(),
                new_price: item.new_price.toString(),
                change_date: item.change_date.toISOString(),
                change_percentage: item.change_percentage?.toString(),
                change_reason: item.change_reason || undefined,
                created_by: item.created_by || undefined
            }));
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException(`Error al obtener el historial de cambios para el item de lista de precios ${priceListItemId}.`);
        }
    }

    /**
     * Obtiene el historial de cambios de precios para toda una lista de precios
     */
    async getPriceListHistory(priceListId: number): Promise<PriceHistoryResponseDto[]> {
        try {
            // Verificar si la lista existe
            await this.findOne(priceListId);

            // Obtener los IDs de los items de la lista
            const items = await this.price_list_item.findMany({
                where: { price_list_id: priceListId },
                select: { price_list_item_id: true }
            });

            if (items.length === 0) {
                return [];
            }

            // Obtener el historial para todos los items de la lista
            const historyItems = await this.price_list_history.findMany({
                where: {
                    price_list_item_id: {
                        in: items.map(item => item.price_list_item_id)
                    }
                },
                orderBy: { change_date: 'desc' },
                include: {
                    price_list_item: {
                        include: {
                            product: true
                        }
                    }
                }
            });

            // Mapear a DTO
            return historyItems.map(item => new PriceHistoryResponseDto({
                history_id: item.history_id,
                price_list_item_id: item.price_list_item_id,
                previous_price: item.previous_price.toString(),
                new_price: item.new_price.toString(),
                change_date: item.change_date.toISOString(),
                change_percentage: item.change_percentage?.toString(),
                change_reason: item.change_reason || undefined,
                created_by: item.created_by || undefined
            }));
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException(`Error al obtener el historial de cambios para la lista de precios ${priceListId}.`);
        }
    }
} 