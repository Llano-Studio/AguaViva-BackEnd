import { Injectable, NotFoundException, OnModuleInit, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { PrismaClient, Prisma, one_off_purchase as PrismaOneOffPurchase } from '@prisma/client';
import { CreateOneOffPurchaseDto } from './dto/create-one-off-purchase.dto';
import { UpdateOneOffPurchaseDto } from './dto/update-one-off-purchase.dto';
import { FilterOneOffPurchasesDto } from './dto/filter-one-off-purchases.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OneOffPurchaseService extends PrismaClient implements OnModuleInit {
    async onModuleInit() {
        await this.$connect();
    }

    async create(createDto: CreateOneOffPurchaseDto): Promise<PrismaOneOffPurchase> {
        const {
            person_id,
            product_id,
            quantity,
            sale_channel_id,
            ...restOfData
        } = createDto;

        try {

            const person = await this.person.findUnique({
                where: {
                    person_id
                }
            });
            if (!person) throw new NotFoundException(`Persona con ID ${person_id} no encontrada.`);

            const product = await this.product.findUnique({
                where: {
                    product_id
                }
            });
            if (!product) throw new NotFoundException(`Producto con ID ${product_id} no encontrado.`);

            const saleChannel = await this.sale_channel.findUnique({
                where:
                {
                    sale_channel_id
                }
            });
            if (!saleChannel) throw new NotFoundException(`Canal de venta con ID ${sale_channel_id} no encontrado.`);

            if (restOfData.locality_id) {
                const locality = await this.locality.findUnique({
                    where:
                    {
                        locality_id: restOfData.locality_id
                    }
                });
                if (!locality) throw new NotFoundException(`Localidad con ID ${restOfData.locality_id} no encontrada.`);
            }
            if (restOfData.zone_id) {
                const zone = await this.zone.findUnique(
                    {
                        where: {
                            zone_id: restOfData.zone_id
                        }
                    }
                );
                if (!zone) throw new NotFoundException(`Zona con ID ${restOfData.zone_id} no encontrada.`);
            }

            const productPrice = new Decimal(product.price);
            const purchaseQuantity = new Decimal(quantity);
            const totalAmount = productPrice.mul(purchaseQuantity);

            return await this.one_off_purchase.create({
                data: {
                    person_id,
                    product_id,
                    quantity,
                    sale_channel_id,
                    ...restOfData,
                    total_amount: totalAmount.toString(),
                    purchase_date: new Date(),
                },
                include: {
                    person: true,
                    product: true,
                    sale_channel: true,
                    locality: true,
                    zone: true,
                }
            });
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2003') {
                    const fieldName = error.meta?.field_name;
                    throw new ConflictException(`Error al crear la compra: La entidad relacionada en el campo '${fieldName}' no fue encontrada o es inválida.`);
                }
            }
            throw new InternalServerErrorException('Error interno al crear la compra de una sola vez.');
        }
    }

    async findAll(filterDto: FilterOneOffPurchasesDto): Promise<PrismaOneOffPurchase[]> {
        const {
            person_id,
            customerName,
            product_id,
            purchaseDateFrom,
            purchaseDateTo,
            sale_channel_id,
            locality_id,
            zone_id,
            page = 1,
            limit = 10
        } = filterDto;

        const skip = (page - 1) * limit;
        const where: Prisma.one_off_purchaseWhereInput = {};

        if (person_id) where.person_id = person_id;
        if (product_id) where.product_id = product_id;
        if (sale_channel_id) where.sale_channel_id = sale_channel_id;
        if (locality_id) where.locality_id = locality_id;
        if (zone_id) where.zone_id = zone_id;

        if (customerName) {
            where.person = {
                name: { contains: customerName, mode: 'insensitive' },
            };
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

        try {
            return await this.one_off_purchase.findMany({
                where,
                include: {
                    person: true,
                    product: true,
                    sale_channel: true,
                    locality: true,
                    zone: true,
                },
                orderBy: { purchase_date: 'desc' },
                skip,
                take: limit,
            });
        } catch (error) {
            throw new InternalServerErrorException('Error al obtener las compras de una sola vez.');
        }
    }

    async findOne(id: number): Promise<PrismaOneOffPurchase> {
        try {
            const purchase = await this.one_off_purchase.findUniqueOrThrow({
                where: { purchase_id: id },
                include: {
                    person: true,
                    product: true,
                    sale_channel: true,
                    locality: true,
                    zone: true,
                },
            });
            return purchase;
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new NotFoundException(`Compra de una sola vez con ID ${id} no encontrada.`);
            }
            throw new InternalServerErrorException(`Error al obtener la compra de una sola vez con ID ${id}.`);
        }
    }

    async update(id: number, updateDto: UpdateOneOffPurchaseDto): Promise<PrismaOneOffPurchase> {
        try {
            const existingPurchase = await this.one_off_purchase.findUniqueOrThrow({
                where: { purchase_id: id },
                include: { product: true },
            });

            const dataToUpdate: Prisma.one_off_purchaseUpdateInput = { ...updateDto };

            if (updateDto.quantity !== undefined || updateDto.product_id !== undefined) {
                const newQuantity = updateDto.quantity !== undefined ? updateDto.quantity : existingPurchase.quantity;
                const newProductId = updateDto.product_id !== undefined ? updateDto.product_id : existingPurchase.product_id;

                const productToCalculate = updateDto.product_id !== undefined
                    ? await this.product.findUniqueOrThrow({ where: { product_id: newProductId } })
                    : existingPurchase.product;

                if (!productToCalculate) {
                    throw new NotFoundException(`Producto con ID ${newProductId} no encontrado para calcular el total.`);
                }

                const productPrice = new Decimal(productToCalculate.price);
                const purchaseQuantity = new Decimal(newQuantity);
                const newTotalAmount = productPrice.mul(purchaseQuantity);
                dataToUpdate.total_amount = newTotalAmount.toString();
            }

            if (updateDto.person_id) {
                await this.person.findUniqueOrThrow({ where: { person_id: updateDto.person_id } });
            }
            if (updateDto.sale_channel_id) {
                await this.sale_channel.findUniqueOrThrow({ where: { sale_channel_id: updateDto.sale_channel_id } });
            }
            if (updateDto.locality_id) {
                await this.locality.findUniqueOrThrow({ where: { locality_id: updateDto.locality_id } });
            }
            if (updateDto.zone_id) {
                await this.zone.findUniqueOrThrow({ where: { zone_id: updateDto.zone_id } });
            }

            return await this.one_off_purchase.update({
                where: { purchase_id: id },
                data: dataToUpdate,
                include: {
                    person: true,
                    product: true,
                    sale_channel: true,
                    locality: true,
                    zone: true,
                },
            });
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    throw new NotFoundException(`Compra de una sola vez con ID ${id} no encontrada.`);
                }
                if (error.code === 'P2003') {
                    const fieldName = error.meta?.field_name;
                    throw new ConflictException(`Error al actualizar la compra: La entidad relacionada en el campo '${fieldName}' no fue encontrada o es inválida.`);
                }
            }
            throw new InternalServerErrorException(`Error al actualizar la compra de una sola vez con ID ${id}.`);
        }
    }

    async remove(id: number): Promise<{ message: string; deleted: boolean }> {
        try {
            await this.one_off_purchase.findUniqueOrThrow({ where: { purchase_id: id } });
            await this.one_off_purchase.delete({ where: { purchase_id: id } });
            return { message: `Compra de una sola vez con ID ${id} eliminada correctamente.`, deleted: true };
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new NotFoundException(`Compra de una sola vez con ID ${id} no encontrada.`);
            }
            throw new InternalServerErrorException(`Error al eliminar la compra de una sola vez con ID ${id}.`);
        }
    }
} 