import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class ProductCategoryService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
  async getAllProductsCategory() {
    try {
      return await this.product_category.findMany({
        include: {
          product: true
        }
      });
    } catch (error) {
      throw new InternalServerErrorException('Error al obtener todas las categorias de productos');
    }
  }

  async getProductCategoryById(id: number) {
    const category = await this.product_category.findUnique({
      where: { category_id: id },
      include: { product: true },
    });
    if (!category) {
      throw new NotFoundException(`Categoria de producto con ID ${id} no encontrada`);
    }
    return category;
  }

  async createProductCategory(dto: CreateProductCategoryDto) {
    try {
      return await this.product_category.create({
        data: dto,
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(`La categoría con el nombre '${dto.name}' ya existe.`);
        }
      }
      throw new InternalServerErrorException('Error al crear una categoria');
    }
  }

  async updateProductCategoryById(id: number, dto: UpdateProductCategoryDto) {
    await this.getProductCategoryById(id);
    try {
      return await this.product_category.update({
        where: { category_id: id },
        data: dto,
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(`El nombre de categoría '${dto.name}' ya está en uso.`);
        }
      }
      throw new InternalServerErrorException(`Error al actualizar la categoria con id #${id}`);
    }
  }

  async deleteProductCategoryById(id: number) {
    await this.getProductCategoryById(id);
    try {
      await this.product_category.delete({
        where: { category_id: id },
      });
      return { message: 'Categoría de producto eliminada exitosamente.', deleted: true };
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new ConflictException(
            'No se puede eliminar la categoría porque tiene productos asociados. Elimine o reasigne los productos primero.',
          );
        }
        throw new InternalServerErrorException(
          'Error al eliminar la categoría debido a una restricción de base de datos.',
        );
      }
      throw new InternalServerErrorException(`Error al eliminar la categoria con id #${id}`);
    }
  }
}