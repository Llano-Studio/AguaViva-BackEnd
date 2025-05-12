import { Injectable, OnModuleInit, InternalServerErrorException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaClient, Prisma, product, price_list, price_list_item } from '@prisma/client';
import { CreatePriceListItemDto, UpdatePriceListItemDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PriceListItemService extends PrismaClient implements OnModuleInit {
    async onModuleInit() {
        await this.$connect();
    }

    private async validatePriceListExists(priceListId: number): Promise<price_list> {
        const priceList = await this.price_list.findUnique({
            where: {
                price_list_id: priceListId
            },
        });
        if (!priceList) {
            throw new BadRequestException(`La lista de precios con ID ${priceListId} no existe.`);
        }
        return priceList;
    }

    private async validateProductExists(productId: number): Promise<product> {
        const product = await this.product.findUnique({
            where: {
                product_id: productId
            },
        });
        if (!product) {
            throw new BadRequestException(`El producto con ID ${productId} no existe.`);
        }
        return product;
    }

    async create(createPriceListItemDto: CreatePriceListItemDto): Promise<price_list_item> {
        await this.validatePriceListExists(createPriceListItemDto.price_list_id);
        await this.validateProductExists(createPriceListItemDto.product_id);

        try {
            return await this.price_list_item.create({
                data: {
                    price_list: {
                        connect: {
                            price_list_id: createPriceListItemDto.price_list_id
                        }
                    },
                    product: {
                        connect: {
                            product_id: createPriceListItemDto.product_id
                        }
                    },
                    unit_price: createPriceListItemDto.unit_price,
                },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    throw new ConflictException('Este producto ya existe en esta lista de precios.');
                }
            }
            throw new InternalServerErrorException('Error al crear el ítem de la lista de precios.');
        }
    }

    async findAll(): Promise<price_list_item[]> {
        try {
            return await this.price_list_item.findMany({
                include: {
                    product: true,
                    price_list: true
                }
            });
        } catch (error) {
            throw new InternalServerErrorException('Error al obtener los ítems de las listas de precios.');
        }
    }

    async findAllByPriceListId(priceListId: number): Promise<price_list_item[]> {
        await this.validatePriceListExists(priceListId);
        try {
            return await this.price_list_item.findMany({
                where: {
                    price_list_id: priceListId
                },
                include: {
                    product: true
                }
            });
        } catch (error) {
            throw new InternalServerErrorException(`Error al obtener los ítems para la lista de precios con ID ${priceListId}.`);
        }
    }

    async findOne(id: number): Promise<price_list_item> {
        const item = await this.price_list_item.findUnique({
            where: {
                price_list_item_id: id
            },
            include: {
                product: true,
                price_list: true
            }
        });
        if (!item) {
            throw new NotFoundException(`Ítem de lista de precios con ID ${id} no encontrado.`);
        }
        return item;
    }

    async update(id: number, updatePriceListItemDto: UpdatePriceListItemDto): Promise<price_list_item> {
        const existingItem = await this.findOne(id);

        const dataToUpdate: Prisma.price_list_itemUpdateInput = {};
        let changesMade = false;

        if (updatePriceListItemDto.price_list_id && updatePriceListItemDto.price_list_id !== existingItem.price_list_id) {
            await this.validatePriceListExists(updatePriceListItemDto.price_list_id);
            dataToUpdate.price_list = {
                connect: {
                    price_list_id: updatePriceListItemDto.price_list_id
                }
            };
            changesMade = true;
        }
        if (updatePriceListItemDto.product_id && updatePriceListItemDto.product_id !== existingItem.product_id) {
            await this.validateProductExists(updatePriceListItemDto.product_id);
            dataToUpdate.product = {
                connect: {
                    product_id: updatePriceListItemDto.product_id
                }
            };
            changesMade = true;
        }

        if (updatePriceListItemDto.unit_price !== undefined) {
            const dtoUnitPriceAsDecimal = new Decimal(updatePriceListItemDto.unit_price);
            if (!dtoUnitPriceAsDecimal.equals(existingItem.unit_price)) {
                if (updatePriceListItemDto.unit_price < 0) {
                    throw new BadRequestException('El precio unitario no puede ser negativo.');
                }
                dataToUpdate.unit_price = updatePriceListItemDto.unit_price;
                changesMade = true;
            }
        }

        if (!changesMade) {
            throw new BadRequestException("No se proporcionaron datos para actualizar o los datos son iguales a los existentes.");
        }

        try {
            return await this.price_list_item.update({
                where: {
                    price_list_item_id: id
                },
                data: dataToUpdate,
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    throw new ConflictException('Al actualizar, la combinación de producto y lista de precios ya existe.');
                }
            }
            throw new InternalServerErrorException(`Error al actualizar el ítem de la lista de precios con ID ${id}.`);
        }
    }

    async remove(id: number): Promise<{ message: string; deleted: boolean }> {
        await this.findOne(id);
        try {
            await this.price_list_item.delete(
                {
                    where: {
                        price_list_item_id: id
                    }
                }
            );
            return { message: 'Ítem de lista de precios eliminado correctamente.', deleted: true };
        } catch (error) {
            throw new InternalServerErrorException(`Error al eliminar el ítem de la lista de precios con ID ${id}.`);
        }
    }
} 