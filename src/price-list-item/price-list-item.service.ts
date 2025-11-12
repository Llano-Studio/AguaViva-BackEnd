import {
  Injectable,
  OnModuleInit,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  PrismaClient,
  Prisma,
  price_list_item as PriceListItemPrisma,
  product as ProductPrisma,
  price_list as PriceListPrisma,
} from '@prisma/client';
import {
  CreatePriceListItemDto,
  UpdatePriceListItemDto,
  PriceListItemResponseDto,
  FilterPriceListItemDto,
} from './dto';
import { Decimal } from '@prisma/client/runtime/library';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';
import { BUSINESS_CONFIG } from '../common/config/business.config';

interface PriceListItemWithRelations extends PriceListItemPrisma {
  product?: ProductPrisma;
  price_list?: PriceListPrisma;
}

@Injectable()
export class PriceListItemService extends PrismaClient implements OnModuleInit {
  private readonly entityName = 'Ítem de Lista de Precios';

  async onModuleInit() {
    await this.$connect();
  }

  private async validatePriceListExists(priceListId: number): Promise<void> {
    const priceList = await this.price_list.findUnique({
      where: { price_list_id: priceListId },
    });
    if (!priceList)
      throw new BadRequestException(
        `La lista de precios con ID ${priceListId} no existe.`,
      );
  }

  private async validateProductExists(productId: number): Promise<void> {
    const product = await this.product.findUnique({
      where: { product_id: productId },
    });
    if (!product)
      throw new BadRequestException(
        `El producto con ID ${productId} no existe.`,
      );
  }

  /**
   * Actualiza el precio del producto individual cuando se trata de la lista general (ID=1)
   */
  private async updateProductPriceIfGeneralList(
    priceListId: number,
    productId: number,
    newPrice: Decimal,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    // Solo actualizar el precio del producto si es la lista general
    if (priceListId === BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID) {
      const prismaClient = tx || this;
      await prismaClient.product.update({
        where: { product_id: productId },
        data: { price: newPrice },
      });
    }
  }

  // Helper para transformar a DTO
  private toPriceListItemResponseDto(
    item: PriceListItemWithRelations,
  ): PriceListItemResponseDto {
    return {
      price_list_item_id: item.price_list_item_id,
      price_list_id: item.price_list_id,
      price_list: item.price_list
        ? {
            price_list_id: item.price_list.price_list_id,
            name: item.price_list.name,
          }
        : undefined,
      product_id: item.product_id,
      product: item.product
        ? {
            product_id: item.product.product_id,
            description: item.product.description,
            // Asumiendo que `code` podría no estar en `ProductPrisma` o ser opcional, como no está en `schema.prisma` `product` model.
            // Si `code` es un campo esperado en `ProductResponseDto` para `product`, se debe asegurar que exista en `ProductPrisma`.
            // code: item.product.code
          }
        : undefined,
      unit_price: parseFloat(item.unit_price.toString()),
    };
  }

  async create(
    createPriceListItemDto: CreatePriceListItemDto,
  ): Promise<PriceListItemResponseDto> {
    await this.validatePriceListExists(createPriceListItemDto.price_list_id);
    await this.validateProductExists(createPriceListItemDto.product_id);

    try {
      const unitPriceDecimal = new Decimal(createPriceListItemDto.unit_price);

      return await this.$transaction(async (tx) => {
        const dataToCreate: Prisma.price_list_itemUncheckedCreateInput = {
          price_list_id: createPriceListItemDto.price_list_id,
          product_id: createPriceListItemDto.product_id,
          unit_price: unitPriceDecimal,
        };

        const newItem = await tx.price_list_item.create({
          data: dataToCreate,
          include: {
            product: true,
            price_list: true,
          },
        });

        // Actualizar el precio del producto individual si es la lista general
        await this.updateProductPriceIfGeneralList(
          createPriceListItemDto.price_list_id,
          createPriceListItemDto.product_id,
          unitPriceDecimal,
          tx,
        );

        return this.toPriceListItemResponseDto(
          newItem as PriceListItemWithRelations,
        );
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Este producto ya existe en esta ${this.entityName.toLowerCase()}.`,
        );
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async findAll(filterDto: FilterPriceListItemDto): Promise<{
    data: PriceListItemResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const {
      page = BUSINESS_CONFIG.PAGINATION.DEFAULT_PAGE,
      limit = BUSINESS_CONFIG.PAGINATION.DEFAULT_LIMIT,
      sortBy,
      price_list_id,
      product_id,
    } = filterDto;
    try {
      const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
      const take = Math.max(1, limit);
      const orderByClause = parseSortByString(sortBy, [
        { product: { description: 'asc' } },
      ]);

      const where: Prisma.price_list_itemWhereInput = {
        price_list: { is_active: true },
        product: { is_active: true },
      };
      if (price_list_id) where.price_list_id = price_list_id;
      if (product_id) where.product_id = product_id;

      const [items, totalItems] = await this.$transaction([
        this.price_list_item.findMany({
          where,
          include: { product: true, price_list: true },
          orderBy: orderByClause,
          skip,
          take,
        }),
        this.price_list_item.count({ where }),
      ]);

      return {
        data: items.map((item) =>
          this.toPriceListItemResponseDto(item as PriceListItemWithRelations),
        ),
        meta: {
          total: totalItems,
          page,
          limit,
          totalPages: Math.ceil(totalItems / take),
        },
      };
    } catch (error) {
      handlePrismaError(error, `${this.entityName}s`);
      throw new InternalServerErrorException(
        'Error no manejado al buscar ítems.',
      );
    }
  }

  async findAllByPriceListId(
    paramPriceListId: number,
    filterDto: FilterPriceListItemDto,
  ): Promise<{
    data: PriceListItemResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const {
      page = BUSINESS_CONFIG.PAGINATION.DEFAULT_PAGE,
      limit = BUSINESS_CONFIG.PAGINATION.DEFAULT_LIMIT,
      sortBy,
      product_id,
    } = filterDto;
    await this.validatePriceListExists(paramPriceListId);
    try {
      const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
      const take = Math.max(1, limit);
      const orderByClause = parseSortByString(sortBy, [
        { product: { description: 'asc' } },
      ]);

      const where: Prisma.price_list_itemWhereInput = {
        price_list_id: paramPriceListId,
        product: { is_active: true },
      };
      if (product_id) where.product_id = product_id;

      const [items, totalItems] = await this.$transaction([
        this.price_list_item.findMany({
          where,
          include: { product: true, price_list: true },
          orderBy: orderByClause,
          skip,
          take,
        }),
        this.price_list_item.count({ where }),
      ]);

      return {
        data: items.map((item) =>
          this.toPriceListItemResponseDto(item as PriceListItemWithRelations),
        ),
        meta: {
          total: totalItems,
          page,
          limit,
          totalPages: Math.ceil(totalItems / take),
        },
      };
    } catch (error) {
      handlePrismaError(
        error,
        `${this.entityName}s para la lista ID ${paramPriceListId}`,
      );
      throw new InternalServerErrorException(
        'Error no manejado al buscar ítems por lista.',
      );
    }
  }

  async findOne(id: number): Promise<PriceListItemResponseDto> {
    const item = await this.price_list_item.findUnique({
      where: { price_list_item_id: id },
      include: {
        product: true,
        price_list: true,
      },
    });
    if (!item) {
      throw new NotFoundException(
        `${this.entityName} con ID ${id} no encontrado.`,
      );
    }
    return this.toPriceListItemResponseDto(item as PriceListItemWithRelations);
  }

  async update(
    id: number,
    updatePriceListItemDto: UpdatePriceListItemDto,
  ): Promise<PriceListItemResponseDto> {
    const existingItem = await this.price_list_item
      .findUniqueOrThrow({
        where: { price_list_item_id: id },
      })
      .catch(() => {
        throw new NotFoundException(
          `${this.entityName} con ID ${id} no encontrado para actualizar.`,
        );
      });

    const dataToUpdate: Prisma.price_list_itemUpdateInput = {};
    let changesMade = false;
    let newUnitPrice: Decimal | undefined;

    if (updatePriceListItemDto.unit_price !== undefined) {
      const dtoUnitPriceAsDecimal = new Decimal(
        updatePriceListItemDto.unit_price,
      );
      const existingUnitPriceAsDecimal = new Decimal(
        existingItem.unit_price.toString(),
      );
      if (!dtoUnitPriceAsDecimal.equals(existingUnitPriceAsDecimal)) {
        if (dtoUnitPriceAsDecimal.isNegative()) {
          throw new BadRequestException(
            'El precio unitario no puede ser negativo.',
          );
        }
        dataToUpdate.unit_price = dtoUnitPriceAsDecimal;
        newUnitPrice = dtoUnitPriceAsDecimal;
        changesMade = true;
      }
    }

    if (!changesMade) {
      const currentItem = await this.price_list_item.findUniqueOrThrow({
        where: { price_list_item_id: id },
        include: { product: true, price_list: true },
      });
      return this.toPriceListItemResponseDto(
        currentItem as PriceListItemWithRelations,
      );
    }

    try {
      return await this.$transaction(async (tx) => {
        const updatedItem = await tx.price_list_item.update({
          where: { price_list_item_id: id },
          data: dataToUpdate,
          include: {
            product: true,
            price_list: true,
          },
        });

        // Actualizar el precio del producto individual si es la lista general y el precio cambió
        if (newUnitPrice) {
          await this.updateProductPriceIfGeneralList(
            existingItem.price_list_id,
            existingItem.product_id,
            newUnitPrice,
            tx,
          );
        }

        return this.toPriceListItemResponseDto(
          updatedItem as PriceListItemWithRelations,
        );
      });
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async remove(id: number): Promise<{ message: string; deleted: boolean }> {
    await this.findOne(id);
    try {
      await this.price_list_item.delete({
        where: { price_list_item_id: id },
      });
      return {
        message: `${this.entityName} eliminado correctamente.`,
        deleted: true,
      };
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }
}
