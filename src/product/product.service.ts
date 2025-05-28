import { Injectable, NotFoundException, OnModuleInit, InternalServerErrorException, ConflictException, BadRequestException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma, PrismaClient, product_category, product as ProductPrisma } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { ProductResponseDto, ProductCategoryResponseDto } from './dto/product-response.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';

@Injectable()
export class ProductService extends PrismaClient implements OnModuleInit {
  private readonly entityName = 'Producto';

  constructor(private readonly inventoryService: InventoryService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  private async validateCategoryExists(categoryId: number): Promise<void> {
    const category = await this.product_category.findUnique({
      where: { category_id: categoryId },
    });
    if (!category) {
      throw new BadRequestException(`La categoría con ID ${categoryId} no existe.`);
    }
  }

  async getAllProducts(filters?: FilterProductsDto): Promise<{ data: ProductResponseDto[], meta: { total: number, page: number, limit: number, totalPages: number} }> {
    try {
      const whereClause: Prisma.productWhereInput = {};
      
      if (filters) {
        if (filters.categoryId) {
          const category = await this.product_category.findUnique({ where: { category_id: filters.categoryId } });
          if (!category) {
              throw new NotFoundException(`Categoría con ID ${filters.categoryId} no encontrada.`);
          }
          whereClause.category_id = filters.categoryId;
        }

        if (filters.description) {
          whereClause.description = {
            contains: filters.description,
            mode: 'insensitive'
          };
        }

        if (filters.isReturnable !== undefined) {
          whereClause.is_returnable = filters.isReturnable;
        }

        if (filters.serialNumber) {
          whereClause.serial_number = {
            contains: filters.serialNumber,
            mode: 'insensitive'
          };
        }
      }

      const page = filters?.page || 1;
      const limit = filters?.limit || 10;
      const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
      const take = Math.max(1, limit);

      const totalProducts = await this.product.count({
        where: whereClause
      });

      const orderByClause = parseSortByString(filters?.sortBy, [{ description: 'asc' }]);

      const products = await this.product.findMany({
        where: whereClause,
        include: {
          product_category: true,
        },
        skip,
        take: take, 
        orderBy: orderByClause,
      });

      const productsWithStock = await Promise.all(
        products.map(async (product) => {
          const stock = await this.inventoryService.getProductStock(product.product_id);
          return new ProductResponseDto({
            ...product,
            price: product.price as any,
            volume_liters: product.volume_liters as any,
            total_stock: stock,
          });
        }),
      );

      return {
        data: productsWithStock,
        meta: {
          total: totalProducts,
          page: page,
          limit: limit,
          totalPages: Math.ceil(totalProducts / take)
        }
      };

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      handlePrismaError(error, `${this.entityName}s`);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async getProductById(id: number): Promise<ProductResponseDto> {
    const productEntity = await this.product.findUnique({
      where: { product_id: id },
      include: { product_category: true },
    });
    if (!productEntity) {
      throw new NotFoundException(`${this.entityName} con ID: ${id} no encontrado`);
    }

    const stock = await this.inventoryService.getProductStock(id);
    
    return new ProductResponseDto({
        ...productEntity,
        price: productEntity.price as any,
        volume_liters: productEntity.volume_liters as any,
        total_stock: stock,
    });
  }

  async createProduct(dto: CreateProductDto): Promise<ProductPrisma> {
    await this.validateCategoryExists(dto.category_id);
    const { category_id, ...productData } = dto;
    try {
      return await this.product.create({
        data: {
          ...productData,
          product_category: {
            connect: { category_id: category_id },
          },
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Ya existe un ${this.entityName.toLowerCase()} con alguna de las propiedades únicas (ej. número de serie).`);
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async updateProductById(id: number, dto: UpdateProductDto): Promise<ProductPrisma> {
    await this.getProductById(id);
    const { category_id, ...productUpdateData } = dto;

    if (category_id) {
      await this.validateCategoryExists(category_id);
    }

    const dataToUpdate: Prisma.productUpdateInput = { ...productUpdateData };
    
    if (category_id) {
      dataToUpdate.product_category = {
        connect: { category_id: category_id },
      };
    }

    try {
      return await this.product.update({
        where: { product_id: id },
        data: dataToUpdate,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException(`Error al actualizar el ${this.entityName.toLowerCase()}, alguna propiedad única ya está en uso (ej. número de serie).`);
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async deleteProductById(id: number): Promise<{ message: string; deleted: boolean }> {
    await this.getProductById(id);
    try {
      await this.product.delete({ where: { product_id: id } });
      return { message: `${this.entityName} eliminado correctamente`, deleted: true };
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }
}