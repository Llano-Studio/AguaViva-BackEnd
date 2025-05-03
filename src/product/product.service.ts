import { Injectable, NotFoundException, OnModuleInit, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class ProductService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
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
    try {
      const product = await this.product.findUnique(
        {
          where: {
            product_id: id
          },
          include: {
            product_category: true
          }
        }
      );
      if (!product) throw new NotFoundException(`Articulo con ID: ${id} no encontrado`);
      return product;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error al obtener el producto');
    }
  }

  async createProduct(dto: CreateProductDto) {
    try {
      return await this.product.create(
        { data: dto });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('El producto que quieres crear ya existe');
        }
      }
      throw new InternalServerErrorException('Error al crear un producto');
    }
  }

  async updateProductById(id: number, dto: UpdateProductDto) {
    await this.getProductById(id);
    try {
      return await this.product.update({
        where: {
          product_id: id
        },
        data: dto,
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Error al actualizar el producto, el código ya existe');
        }
      }
      throw new InternalServerErrorException(`Error al actualizar el producto con id: #${id}`);
    }
  }

  async deleteProductById(id: number) {
    await this.getProductById(id);
    try {
      await this.product.delete({ where: { product_id: id } });
      return { deleted: true };
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new InternalServerErrorException('Error al eliminar el producto');
      }
      throw new InternalServerErrorException(`Error al eliminar el producto con id: #${id}`);
    }
  }
}