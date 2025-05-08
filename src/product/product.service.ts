import { Injectable, NotFoundException, OnModuleInit, InternalServerErrorException, ConflictException, BadRequestException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class ProductService extends PrismaClient implements OnModuleInit {
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

  async getAllProducts() {
    try {
      return await this.product.findMany({
        include: {
          product_category: true
        }
      });

    } catch (error) {
      throw new InternalServerErrorException('Error al obtener todos los productos');
    }
  }

  async getProductById(id: number) {
    const product = await this.product.findUnique({
      where: { product_id: id },
      include: { product_category: true },
    });
    if (!product) {
      throw new NotFoundException(`Producto con ID: ${id} no encontrado`);
    }
    return product;
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