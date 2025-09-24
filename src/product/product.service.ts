import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  Prisma,
  PrismaClient,
  product as ProductPrisma,
} from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import {
  ProductResponseDto,
} from './dto/product-response.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';
import { buildImageUrl } from '../common/utils/file-upload.util';
import { BUSINESS_CONFIG } from '../common/config/business.config';

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
      throw new BadRequestException(
        `La categoría con ID ${categoryId} no existe.`,
      );
    }
  }

  private async validateDefaultPriceListExists(): Promise<void> {
    // Verificar si existe una lista marcada como por defecto
    const defaultPriceList = await this.price_list.findFirst({
      where: { is_default: true },
    });

    if (!defaultPriceList) {
      throw new BadRequestException(
        'No se puede crear el producto. No existe ninguna lista de precios marcada como por defecto. ' +
          'Debe existir y activar una lista de precios como por defecto para poder crear productos.',
      );
    }

    if (!defaultPriceList.active) {
      throw new BadRequestException(
        `No se puede crear el producto. La lista de precios por defecto "${defaultPriceList.name}" está inactiva. ` +
          'La lista de precios por defecto debe estar activa para poder crear productos.',
      );
    }

    // También verificar que la lista configurada existe (para retrocompatibilidad)
    const configuredPriceList = await this.price_list.findUnique({
      where: { price_list_id: BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID },
    });
    if (!configuredPriceList) {
      throw new BadRequestException(
        `No se puede crear el producto. La lista de precios configurada (ID: ${BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID}) no existe. ` +
          'Verifique la configuración del sistema.',
      );
    }
  }

  async getAllProducts(filters?: FilterProductsDto): Promise<{
    data: ProductResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    try {
      const whereClause: Prisma.productWhereInput = {};

      if (filters) {
        // Búsqueda general en múltiples campos
        if (filters.search) {
          whereClause.OR = [
            { description: { contains: filters.search, mode: 'insensitive' } },
            {
              serial_number: { contains: filters.search, mode: 'insensitive' },
            },
            { notes: { contains: filters.search, mode: 'insensitive' } },
          ];
        }

        // Filtros específicos de categorías (múltiples o única)
        if (filters.categoryIds && filters.categoryIds.length > 0) {
          // Validar que todas las categorías existan
          for (const categoryId of filters.categoryIds) {
            const category = await this.product_category.findUnique({
              where: { category_id: categoryId },
            });
            if (!category) {
              throw new NotFoundException(
                `Categoría con ID ${categoryId} no encontrada.`,
              );
            }
          }
          // Si se proporcionan múltiples categorías, usar operador IN
          whereClause.category_id = { in: filters.categoryIds };
        } else if (filters.categoryId) {
          // Si solo se proporciona una categoría (compatibilidad), usar equality
          const category = await this.product_category.findUnique({
            where: { category_id: filters.categoryId },
          });
          if (!category) {
            throw new NotFoundException(
              `Categoría con ID ${filters.categoryId} no encontrada.`,
            );
          }
          whereClause.category_id = filters.categoryId;
        }

        if (filters.description) {
          whereClause.description = {
            contains: filters.description,
            mode: 'insensitive',
          };
        }

        if (filters.isReturnable !== undefined) {
          whereClause.is_returnable = filters.isReturnable;
        }

        if (filters.serialNumber) {
          whereClause.serial_number = {
            contains: filters.serialNumber,
            mode: 'insensitive',
          };
        }
      }

      const page = filters?.page || 1;
      const limit = filters?.limit || 10;
      const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
      const take = Math.max(1, limit);

      const totalProducts = await this.product.count({
        where: whereClause,
      });

      const orderByClause = parseSortByString(filters?.sortBy, [
        { description: 'asc' },
      ]);

      const includeInventory = filters?.includeInventory ?? false;

      const products = await this.product.findMany({
        where: whereClause,
        include: {
          product_category: true,
          ...(includeInventory && {
            inventory: {
              include: {
                warehouse: {
                  include: {
                    locality: true,
                  },
                },
              },
            },
          }),
        },
        skip,
        take: take,
        orderBy: orderByClause,
      });

      const productsWithStock = await Promise.all(
        products.map(async (product) => {
          const stock = await this.inventoryService.getProductStock(
            product.product_id,
          );
          return new ProductResponseDto({
            ...product,
            price: product.price as any,
            volume_liters: product.volume_liters as any,
            total_stock: stock,
            inventory: includeInventory
              ? (product as any).inventory
              : undefined,
            image_url: buildImageUrl(product.image_url, 'products'),
          });
        }),
      );

      return {
        data: productsWithStock,
        meta: {
          total: totalProducts,
          page: page,
          limit: limit,
          totalPages: Math.ceil(totalProducts / take),
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      handlePrismaError(error, `${this.entityName}s`);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async getProductById(
    id: number,
    includeInventory: boolean = true,
  ): Promise<ProductResponseDto> {
    const productEntity = await this.product.findUnique({
      where: { product_id: id },
      include: {
        product_category: true,
        ...(includeInventory && {
          inventory: {
            include: {
              warehouse: {
                include: {
                  locality: true,
                },
              },
            },
          },
        }),
      },
    });
    if (!productEntity) {
      throw new NotFoundException(
        `${this.entityName} con ID: ${id} no encontrado`,
      );
    }

    const stock = await this.inventoryService.getProductStock(id);

    return new ProductResponseDto({
      ...productEntity,
      price: productEntity.price as any,
      volume_liters: productEntity.volume_liters as any,
      total_stock: stock,
      inventory: includeInventory
        ? (productEntity as any).inventory
        : undefined,
      image_url: buildImageUrl(productEntity.image_url, 'products'),
    });
  }

  async createProduct(
    dto: CreateProductDto,
    productImage?: any,
  ): Promise<ProductResponseDto> {
    // Asegurar existencia de lista de precios estándar (ID 1) y almacén principal (ID 1)
    const defaultPriceListId = BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID;
    await this.price_list.upsert({
      where: { price_list_id: defaultPriceListId },
      update: { is_default: true, active: true },
      create: {
        price_list_id: defaultPriceListId,
        name: BUSINESS_CONFIG.PRICING.STANDARD_PRICE_LIST_NAME,
        effective_date: new Date(),
        is_default: true,
        active: true,
      },
    });
    const defaultWarehouseId = BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID;
    await this.warehouse.upsert({
      where: { warehouse_id: defaultWarehouseId },
      update: {},
      create: {
        warehouse_id: defaultWarehouseId,
        name: 'Almacén Principal',
      },
    });
    await this.validateCategoryExists(dto.category_id);
    await this.validateDefaultPriceListExists();
    const { category_id, total_stock, productImage: _, ...productData } = dto;

    // DEBUG: Log para ver qué datos se van a guardar
    console.log('🔍 DEBUG - Datos que se van a guardar en createProduct:');
    console.log('  productData.is_returnable:', productData.is_returnable, typeof productData.is_returnable);
    console.log('  productData completo:', JSON.stringify(productData, null, 2));

    try {
      const dataToCreate: any = {
        ...productData,
        product_category: {
          connect: { category_id: category_id },
        },
      };

      // Si se subió una imagen, guardar la URL
      if (productImage?.filename) {
        dataToCreate.image_url = productImage.filename;
      }

      return await this.$transaction(async (prismaTx) => {
        const product = await prismaTx.product.create({
          data: dataToCreate,
          include: {
            product_category: true,
            inventory: {
              include: {
                warehouse: {
                  include: {
                    locality: true,
                  },
                },
              },
            },
          },
        });

        // Automáticamente agregar el producto a la lista de precios estándar
        await prismaTx.price_list_item.create({
          data: {
            price_list_id: BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID,
            product_id: product.product_id,
            unit_price: product.price,
          },
        });

        // Crear inventario inicial si se especifica total_stock
        if (total_stock !== undefined && total_stock > 0) {
          await this.inventoryService.createInitialInventory(
            {
              product_id: product.product_id,
              warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
              quantity: total_stock,
              remarks: `Stock inicial - ${product.description}`,
            },
            prismaTx,
          );
        }

        const stock = await this.inventoryService.getProductStock(
          product.product_id,
          undefined,
          prismaTx,
        );

        return new ProductResponseDto({
          ...product,
          price: product.price as any,
          volume_liters: product.volume_liters as any,
          total_stock: stock,
          inventory: product.inventory as any,
          image_url: buildImageUrl(product.image_url, 'products'),
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Ya existe un ${this.entityName.toLowerCase()} con alguna de las propiedades únicas (ej. número de serie).`,
        );
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async updateProductById(
    id: number,
    dto: UpdateProductDto,
    productImage?: any,
  ): Promise<ProductResponseDto> {
    await this.getProductById(id, false);
    const {
      category_id,
      total_stock,
      productImage: _,
      ...productUpdateData
    } = dto;

    // DEBUG: Log para ver qué datos se van a actualizar
    console.log('🔍 DEBUG - Datos que se van a actualizar en updateProductById:');
    console.log('  productUpdateData.is_returnable:', productUpdateData.is_returnable, typeof productUpdateData.is_returnable);
    console.log('  productUpdateData completo:', JSON.stringify(productUpdateData, null, 2));

    if (category_id) {
      await this.validateCategoryExists(category_id);
    }

    const dataToUpdate: any = { ...productUpdateData };

    if (category_id) {
      dataToUpdate.product_category = {
        connect: { category_id: category_id },
      };
    }

    // Si se subió una nueva imagen, actualizar la URL
    if (productImage?.filename) {
      dataToUpdate.image_url = productImage.filename;
    }

    try {
      return await this.$transaction(async (prismaTx) => {
        const updatedProduct = await prismaTx.product.update({
          where: { product_id: id },
          data: dataToUpdate,
          include: {
            product_category: true,
            inventory: {
              include: {
                warehouse: {
                  include: {
                    locality: true,
                  },
                },
              },
            },
          },
        });

        // Actualizar precio unitario en la lista general si se modificó el precio del producto
        if (dto.price !== undefined) {
          await prismaTx.price_list_item.updateMany({
            where: {
              product_id: id,
              price_list_id: BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID,
            },
            data: { unit_price: updatedProduct.price },
          });
        }

        // Manejar ajuste de stock si se proporciona total_stock
        if (total_stock !== undefined) {
          await this.handleStockAdjustment(
            id,
            total_stock,
            updatedProduct.description,
            prismaTx,
          );
        }

        const stock = await this.inventoryService.getProductStock(
          id,
          undefined,
          prismaTx,
        );

        return new ProductResponseDto({
          ...updatedProduct,
          price: updatedProduct.price as any,
          volume_liters: updatedProduct.volume_liters as any,
          total_stock: stock,
          inventory: updatedProduct.inventory as any,
          image_url: buildImageUrl(updatedProduct.image_url, 'products'),
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Error al actualizar el ${this.entityName.toLowerCase()}, alguna propiedad única ya está en uso (ej. número de serie).`,
        );
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async deleteProductById(
    id: number,
  ): Promise<{ message: string; deleted: boolean }> {
    await this.getProductById(id, false);
    try {
      // Eliminar referencias en tablas dependientes antes de borrar el producto
      await this.$transaction(async (prismaTx) => {
        await prismaTx.price_list_item.deleteMany({
          where: { product_id: id },
        });
        await prismaTx.subscription_plan_product.deleteMany({
          where: { product_id: id },
        });
        await prismaTx.inventory.deleteMany({ where: { product_id: id } });
        await prismaTx.inventory_transaction.deleteMany({
          where: { product_id: id },
        });
        await prismaTx.payment_line.deleteMany({ where: { product_id: id } });
        await prismaTx.order_item.deleteMany({ where: { product_id: id } });
        await prismaTx.one_off_purchase.deleteMany({
          where: { product_id: id },
        });
        // Finalmente eliminar el producto
        await prismaTx.product.delete({ where: { product_id: id } });
      });
      return {
        message: `${this.entityName} eliminado correctamente`,
        deleted: true,
      };
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async deleteProductImage(id: number): Promise<ProductResponseDto> {
    const product = await this.getProductById(id, false);

    if (!product.image_url) {
      throw new NotFoundException('El producto no tiene una imagen asociada.');
    }

    try {
      // Extraer el nombre del archivo de la URL
      const fileName = product.image_url.split('/').pop();
      if (fileName) {
        const filePath = path.join(
          process.cwd(),
          'public',
          'uploads',
          'products',
          fileName,
        );

        // Eliminar el archivo físico si existe
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
        }
      }

      // Actualizar el producto eliminando la referencia a la imagen
      const updatedProduct = await this.product.update({
        where: { product_id: id },
        data: { image_url: null },
        include: {
          product_category: true,
          inventory: {
            include: {
              warehouse: {
                include: {
                  locality: true,
                },
              },
            },
          },
        },
      });

      const stock = await this.inventoryService.getProductStock(id);

      return new ProductResponseDto({
        ...updatedProduct,
        price: updatedProduct.price as any,
        volume_liters: updatedProduct.volume_liters as any,
        total_stock: stock,
        inventory: updatedProduct.inventory as any,
        image_url: null,
      });
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async getProductImage(
    id: number,
  ): Promise<{ product_id: number; image_url: string | null }> {
    const product = await this.getProductById(id, false);

    return {
      product_id: id,
      image_url: product.image_url || null,
    };
  }

  /**
   * Maneja los ajustes de stock cuando se actualiza el total_stock de un producto
   */
  private async handleStockAdjustment(
    productId: number,
    newTotalStock: number,
    productDescription: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    // Obtener el stock actual del producto en el almacén por defecto
    const currentStock = await this.inventoryService.getProductStock(
      productId,
      BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
      tx,
    );

    const stockDifference = newTotalStock - currentStock;

    if (stockDifference === 0) {
      return; // No hay cambios en el stock
    }

    // Verificar si existe inventario en el almacén por defecto
    const existingInventory = await tx.inventory.findUnique({
      where: {
        warehouse_id_product_id: {
          warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
          product_id: productId,
        },
      },
    });

    if (!existingInventory && newTotalStock > 0) {
      // No existe inventario, crear uno nuevo con stock inicial
      await this.inventoryService.createInitialInventory(
        {
          product_id: productId,
          warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
          quantity: newTotalStock,
          remarks: `Stock inicial - ${productDescription}`,
        },
        tx,
      );
    } else if (stockDifference !== 0) {
      // Existe inventario, crear movimiento de ajuste
      const isPositiveAdjustment = stockDifference > 0;
      const movementTypeCode = isPositiveAdjustment
        ? BUSINESS_CONFIG.MOVEMENT_TYPES.AJUSTE_POSITIVO
        : BUSINESS_CONFIG.MOVEMENT_TYPES.AJUSTE_NEGATIVO;

      const movementTypeId =
        await this.inventoryService.getMovementTypeIdByCode(
          movementTypeCode,
          tx,
        );

      await this.inventoryService.createStockMovement(
        {
          movement_type_id: movementTypeId,
          product_id: productId,
          quantity: Math.abs(stockDifference),
          source_warehouse_id: isPositiveAdjustment
            ? null
            : BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
          destination_warehouse_id: isPositiveAdjustment
            ? BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID
            : null,
          movement_date: new Date(),
          remarks: `Ajuste de stock - ${productDescription}. Stock anterior: ${currentStock}, Stock nuevo: ${newTotalStock}`,
        },
        tx,
      );
    }
  }
}
