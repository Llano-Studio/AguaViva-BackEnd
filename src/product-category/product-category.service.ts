import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import {
  Prisma,
  PrismaClient,
  product_category as ProductCategoryPrisma,
} from '@prisma/client';
import { FilterProductCategoriesDto } from './dto/filter-product-categories.dto';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { BUSINESS_CONFIG } from '../common/config/business.config';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';

@Injectable()
export class ProductCategoryService
  extends PrismaClient
  implements OnModuleInit
{
  private readonly entityName = 'Categoría de Producto';

  async onModuleInit() {
    await this.$connect();
  }

  async findAll(filters: FilterProductCategoriesDto): Promise<{
    data: ProductCategoryPrisma[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const {
      page = BUSINESS_CONFIG.PAGINATION.DEFAULT_PAGE,
      limit = BUSINESS_CONFIG.PAGINATION.DEFAULT_LIMIT,
      sortBy,
      search,
      name,
    } = filters;
    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const take = Math.max(1, limit);

    const where: Prisma.product_categoryWhereInput = {};

    // Búsqueda general en múltiples campos
    if (search) {
      where.OR = [{ name: { contains: search, mode: 'insensitive' } }];
    }

    // Filtros específicos
    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }

    const orderBy = parseSortByString(sortBy, [{ name: 'asc' }]);

    try {
      const categories = await this.product_category.findMany({
        where,
        include: {
          product: true,
        },
        orderBy,
        skip,
        take,
      });

      const totalCategories = await this.product_category.count({ where });

      return {
        data: categories,
        meta: {
          total: totalCategories,
          page,
          limit,
          totalPages: Math.ceil(totalCategories / take),
        },
      };
    } catch (error) {
      handlePrismaError(error, `${this.entityName}s`);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async getProductCategoryById(id: number): Promise<ProductCategoryPrisma> {
    const category = await this.product_category.findUnique({
      where: { category_id: id },
      include: { product: true },
    });
    if (!category) {
      throw new NotFoundException(
        `${this.entityName} con ID ${id} no encontrada`,
      );
    }
    return category;
  }

  async createProductCategory(
    dto: CreateProductCategoryDto,
  ): Promise<ProductCategoryPrisma> {
    try {
      return await this.product_category.create({
        data: dto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `La ${this.entityName.toLowerCase()} con el nombre '${dto.name}' ya existe.`,
        );
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async updateProductCategoryById(
    id: number,
    dto: UpdateProductCategoryDto,
  ): Promise<ProductCategoryPrisma> {
    await this.getProductCategoryById(id);
    try {
      return await this.product_category.update({
        where: { category_id: id },
        data: dto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `El nombre de ${this.entityName.toLowerCase()} '${dto.name}' ya está en uso.`,
        );
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async deleteProductCategoryById(
    id: number,
  ): Promise<{ message: string; deleted: boolean }> {
    await this.getProductCategoryById(id);
    try {
      await this.product_category.delete({
        where: { category_id: id },
      });
      return {
        message: `${this.entityName} eliminada correctamente.`,
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
