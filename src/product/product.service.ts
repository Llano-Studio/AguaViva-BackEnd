import { Injectable, NotFoundException, OnModuleInit, InternalServerErrorException, ConflictException, BadRequestException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma, PrismaClient, product_category } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { ProductResponseDto, ProductCategoryResponseDto } from './dto/product-response.dto';
import { FilterProductsDto } from './dto/filter-products.dto';

@Injectable()
export class ProductService extends PrismaClient implements OnModuleInit {
  constructor(private readonly inventoryService: InventoryService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  private async validateCategoryExists(categoryId: number) {
    const category = await this.product_category.findUnique({
      where: { category_id: categoryId },
    });
    if (!category) {
      throw new BadRequestException(`La categoría con ID ${categoryId} no existe.`);
    }
  }

  async getAllProducts(filters?: FilterProductsDto) {
    try {
      const whereClause: Prisma.productWhereInput = {};
      
      // Aplicar filtros si se proporcionan
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
            mode: 'insensitive' // Búsqueda que no distingue entre mayúsculas y minúsculas
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

      // Establecer valores por defecto para paginación
      const page = filters?.page || 1;
      const limit = filters?.limit || 10;
      const skip = (page - 1) * limit;

      // Consultar total de resultados para la paginación
      const totalProducts = await this.product.count({
        where: whereClause
      });

      // Obtener productos con paginación
      const products = await this.product.findMany({
        where: whereClause,
        include: {
          product_category: true,
        },
        skip,
        take: limit,
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

      // Retornar resultados con metadatos de paginación
      return {
        data: productsWithStock,
        meta: {
          total: totalProducts,
          page: page,
          limit: limit,
          totalPages: Math.ceil(totalProducts / limit)
        }
      };

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error en getAllProducts: ", error);
      throw new InternalServerErrorException('Error al obtener los productos');
    }
  }

  async getProductById(id: number): Promise<ProductResponseDto> {
    const productEntity = await this.product.findUnique({
      where: { product_id: id },
      include: { product_category: true },
    });
    if (!productEntity) {
      throw new NotFoundException(`Producto con ID: ${id} no encontrado`);
    }

    const stock = await this.inventoryService.getProductStock(id);
    
    return new ProductResponseDto({
        ...productEntity,
        price: productEntity.price as any,
        volume_liters: productEntity.volume_liters as any,
        total_stock: stock,
    });
  }

  async createProduct(dto: CreateProductDto) {
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
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Ya existe un producto con alguna de las propiedades únicas (ej. número de serie).');
        }
      }
      throw new InternalServerErrorException('Error al crear un producto');
    }
  }

  async updateProductById(id: number, dto: UpdateProductDto) {
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
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Error al actualizar el producto, alguna propiedad única ya está en uso (ej. número de serie).');
        }
      }
      throw new InternalServerErrorException(`Error al actualizar el producto con id: #${id}`);
    }
  }

  async deleteProductById(id: number) {
    await this.getProductById(id);
    try {
      await this.product.delete({ where: { product_id: id } });
      return { message: 'Producto eliminado correctamente', deleted: true };
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new ConflictException('No se puede eliminar el producto porque está siendo referenciado en otras partes del sistema (ej. pedidos, inventario).');
        }
        throw new InternalServerErrorException('Error al eliminar el producto debido a una restricción de base de datos.');
      }
      throw new InternalServerErrorException(`Error al eliminar el producto con id: #${id}`);
    }
  }
}