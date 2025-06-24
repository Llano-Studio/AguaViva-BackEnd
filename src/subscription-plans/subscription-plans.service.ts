import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, OnModuleInit, BadRequestException } from '@nestjs/common';
import { PrismaClient, subscription_plan as SubscriptionPlanPrisma, Prisma, SubscriptionStatus, product as ProductPrisma, subscription_plan_product as SubscriptionPlanProductPrisma } from '@prisma/client';
import { CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto, AddProductToPlanDto, UpdateProductInPlanDto, AdjustPlanProductQuantitiesDto, AdjustAllPlansPriceDto, SubscriptionPlanResponseDto, SubscriptionPlanProductResponseDto, PaginatedSubscriptionPlanResponseDto, FilterSubscriptionPlansDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';

@Injectable()
export class SubscriptionPlansService extends PrismaClient implements OnModuleInit {
  private readonly entityName = 'Plan de Suscripción';

  async onModuleInit() {
    await this.$connect();
  }

  private toSubscriptionPlanProductResponseDto(spp: SubscriptionPlanProductPrisma & { product?: ProductPrisma }): SubscriptionPlanProductResponseDto {
    return {
      product_id: spp.product_id,
      product_description: spp.product?.description || 'N/A',
      quantity: spp.product_quantity,
    };
  }

  private toSubscriptionPlanResponseDto(plan: SubscriptionPlanPrisma & { subscription_plan_product?: (SubscriptionPlanProductPrisma & { product?: ProductPrisma })[] }): SubscriptionPlanResponseDto {
    return {
      subscription_plan_id: plan.subscription_plan_id,
      name: plan.name,
      description: plan.description || undefined,
      price: plan.price ? parseFloat(plan.price.toString()) : 0,
      default_cycle_days: (plan as any).default_cycle_days || 30,
      default_deliveries_per_cycle: (plan as any).default_deliveries_per_cycle || 1,
      is_active: (plan as any).is_active !== undefined ? (plan as any).is_active : true,
      created_at: (plan as any).created_at || new Date(),
      updated_at: (plan as any).updated_at || new Date(),
      products: plan.subscription_plan_product?.map(p => this.toSubscriptionPlanProductResponseDto(p)) || [],
    };
  }

  async create(createSubscriptionPlanDto: CreateSubscriptionPlanDto): Promise<SubscriptionPlanResponseDto> {
    try {
      const newPlan = await this.subscription_plan.create({
        data: {
          name: createSubscriptionPlanDto.name,
          description: createSubscriptionPlanDto.description,
          price: createSubscriptionPlanDto.price,
          default_cycle_days: createSubscriptionPlanDto.default_cycle_days,
          default_deliveries_per_cycle: createSubscriptionPlanDto.default_deliveries_per_cycle,
          is_active: createSubscriptionPlanDto.is_active,
        },
        include: {
          subscription_plan_product: { 
            include: {
              product: true, 
            },
          },
        }
      });
      return this.toSubscriptionPlanResponseDto(newPlan);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') { 
          throw new ConflictException(
            `Conflicto al crear el ${this.entityName.toLowerCase()}. Verifique que no haya campos duplicados que deban ser únicos.`,
          );
        }
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async findAll(filters: FilterSubscriptionPlansDto): Promise<PaginatedSubscriptionPlanResponseDto> {
    const { sortBy, search, name, is_active, page = 1, limit = 10 } = filters;
    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const take = Math.max(1, limit);
    
    const where: Prisma.subscription_planWhereInput = {};
    
    // Búsqueda general en múltiples campos
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Filtros específicos
    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }

    // Filtro por estado de activación
    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    const orderByClause = parseSortByString(sortBy, [{ name: 'asc' }]);

    try {
        const plans = await this.subscription_plan.findMany({
          where,
          include: {
            subscription_plan_product: { 
              include: {
                product: true, 
              },
            },
          },
          orderBy: orderByClause,
          skip,
          take
        });

        const totalPlans = await this.subscription_plan.count({ where });

        return {
          data: plans.map(plan => this.toSubscriptionPlanResponseDto(plan)),
          meta: {
            total: totalPlans,
            page,
            limit,
            totalPages: Math.ceil(totalPlans / take)
          }
        };
    } catch (error) {
        handlePrismaError(error, `${this.entityName}s`);
        throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async findOne(id: number): Promise<SubscriptionPlanResponseDto> {
    const plan = await this.subscription_plan.findUnique({
      where: { subscription_plan_id: id },
      include: {
        subscription_plan_product: {
          include: {
            product: true,
          },
        },
      },
    });
    if (!plan) {
      throw new NotFoundException(`${this.entityName} con ID ${id} no encontrado.`);
    }
    return this.toSubscriptionPlanResponseDto(plan);
  }

  async update(id: number, updateSubscriptionPlanDto: UpdateSubscriptionPlanDto): Promise<SubscriptionPlanResponseDto> {
    await this.findOne(id);
    try {
      const updatedPlan = await this.subscription_plan.update({
        where: { subscription_plan_id: id },
        data: {
            name: updateSubscriptionPlanDto.name,
            description: updateSubscriptionPlanDto.description,
            price: updateSubscriptionPlanDto.price,
            default_cycle_days: updateSubscriptionPlanDto.default_cycle_days,
            default_deliveries_per_cycle: updateSubscriptionPlanDto.default_deliveries_per_cycle,
            is_active: updateSubscriptionPlanDto.is_active,
        },
        include: {
            subscription_plan_product: {
                include: { product: true }
            }
        }
      });
      return this.toSubscriptionPlanResponseDto(updatedPlan);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
             throw new ConflictException(`Error de conflicto al actualizar el ${this.entityName.toLowerCase()}. Verifique los datos.`);
        }
        handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async remove(id: number): Promise<{ message: string, deleted: boolean }> {
    const plan = await this.findOne(id); 

    const activeCustomerSubscriptions = await this.customer_subscription.count({
      where: {
        subscription_plan_id: id,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED] } 
      },
    });

    if (activeCustomerSubscriptions > 0) {
      throw new ConflictException(
        `El ${this.entityName.toLowerCase()} con ID ${id} no puede ser eliminado porque tiene ${activeCustomerSubscriptions} suscripciones de clientes asociadas activas o pausadas. Considere cancelarlas primero.`,
      );
    }
    
    try {
        await this.subscription_plan_product.deleteMany({
            where: { subscription_plan_id: id }
        });
        
        await this.subscription_plan.delete({
          where: { subscription_plan_id: id },
        });
        return { message: `${this.entityName} con ID ${id} y sus productos asociados eliminados correctamente.`, deleted: true };
    } catch (error) {
        handlePrismaError(error, this.entityName);
        throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async addProductToPlan(planId: number, addProductToPlanDto: AddProductToPlanDto): Promise<SubscriptionPlanResponseDto> {
    await this.findOne(planId);
 
    const product = await this.product.findUnique({ where: { product_id: addProductToPlanDto.product_id } });
    if (!product) {
      throw new NotFoundException(`Producto con ID ${addProductToPlanDto.product_id} no encontrado.`);
    }

    const existingProductInPlan = await this.subscription_plan_product.findFirst({
      where: {
        subscription_plan_id: planId,
        product_id: addProductToPlanDto.product_id,
      },
    });

    if (existingProductInPlan) {
      throw new ConflictException(
        `El producto con ID ${addProductToPlanDto.product_id} ya existe en el ${this.entityName.toLowerCase()} con ID ${planId}.`,
      );
    }

    try {
      await this.subscription_plan_product.create({
        data: {
          subscription_plan_id: planId,
          product_id: addProductToPlanDto.product_id,
          product_quantity: addProductToPlanDto.product_quantity,
        },
      });
      const updatedPlan = await this.subscription_plan.findUniqueOrThrow({ 
          where: { subscription_plan_id: planId }, 
          include: { subscription_plan_product: { include: { product: true } } }
      });
      return this.toSubscriptionPlanResponseDto(updatedPlan);
    } catch (error) {
      handlePrismaError(error, `producto al ${this.entityName.toLowerCase()}`);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async updateProductInPlan(planId: number, productId: number, updateProductInPlanDto: UpdateProductInPlanDto): Promise<SubscriptionPlanResponseDto> {
    await this.findOne(planId);
     const product = await this.product.findUnique({ where: { product_id: productId } });
    if (!product) {
      throw new NotFoundException(`Producto con ID ${productId} no encontrado.`);
    }

    const existingEntry = await this.subscription_plan_product.findFirst({
      where: {
        subscription_plan_id: planId,
        product_id: productId,
      },
    });

    if (!existingEntry) {
      throw new NotFoundException(
        `Producto con ID ${productId} no encontrado en el ${this.entityName.toLowerCase()} ID ${planId}.`,
      );
    }

    try {
      await this.subscription_plan_product.update({
        where: {
          spp_id: existingEntry.spp_id 
        },
        data: {
          product_quantity: updateProductInPlanDto.product_quantity,
        },
      });
      const updatedPlan = await this.subscription_plan.findUniqueOrThrow({ 
          where: { subscription_plan_id: planId }, 
          include: { subscription_plan_product: { include: { product: true } } }
      });
      return this.toSubscriptionPlanResponseDto(updatedPlan);
    } catch (error) {
      handlePrismaError(error, `producto en el ${this.entityName.toLowerCase()}`);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async removeProductFromPlan(planId: number, productId: number): Promise<SubscriptionPlanResponseDto> {
    await this.findOne(planId);
    
    const product = await this.product.findUnique({ where: { product_id: productId } });
    if (!product) {
      throw new NotFoundException(`Producto con ID ${productId} no encontrado (no se puede eliminar de un plan si el producto en sí no existe).`);
    }

    const existingEntry = await this.subscription_plan_product.findFirst({
      where: {
        subscription_plan_id: planId,
        product_id: productId,
      },
    });

    if (!existingEntry) {
      throw new NotFoundException(
        `Producto con ID ${productId} no se pudo encontrar en el ${this.entityName.toLowerCase()} ID ${planId} para eliminar.`,
      );
    }
    
    try {
      await this.subscription_plan_product.delete({
        where: { 
            spp_id: existingEntry.spp_id 
        },
      });
      const updatedPlan = await this.subscription_plan.findUniqueOrThrow({ 
          where: { subscription_plan_id: planId }, 
          include: { subscription_plan_product: { include: { product: true } } }
      });
      return this.toSubscriptionPlanResponseDto(updatedPlan);
    } catch (error) {
      handlePrismaError(error, `producto del ${this.entityName.toLowerCase()}`);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async adjustProductQuantitiesInPlan(planId: number, dto: AdjustPlanProductQuantitiesDto): Promise<SubscriptionPlanResponseDto> {
    await this.findOne(planId);

    const { products: productAdjustments } = dto;

    if (!productAdjustments || productAdjustments.length === 0) {
        const currentPlan = await this.subscription_plan.findUniqueOrThrow({ 
            where: { subscription_plan_id: planId }, 
            include: { subscription_plan_product: { include: { product: true } } }
        });
        return this.toSubscriptionPlanResponseDto(currentPlan);
    }

    for (const adj of productAdjustments) {
        const product = await this.product.findUnique({ where: { product_id: adj.product_id } });
        if (!product) {
            throw new NotFoundException(`Producto con ID ${adj.product_id} en la lista de ajustes no encontrado.`);
        }
        if (adj.quantity < 0) {
            throw new BadRequestException(`La cantidad para el producto ID ${adj.product_id} no puede ser negativa.`);
        }
    }

    await this.$transaction(async (prisma) => {
      const currentProductsInPlan = await prisma.subscription_plan_product.findMany({
        where: { subscription_plan_id: planId },
      });

      for (const adj of productAdjustments) {
        const existingProduct = currentProductsInPlan.find(p => p.product_id === adj.product_id);

        if (adj.quantity === 0) {
          if (existingProduct) {
            await prisma.subscription_plan_product.delete({
              where: { spp_id: existingProduct.spp_id },
            });
          }
        } else if (existingProduct) {
          await prisma.subscription_plan_product.update({
            where: { spp_id: existingProduct.spp_id },
            data: { product_quantity: adj.quantity },
          });
        } else {
          await prisma.subscription_plan_product.create({
            data: {
              subscription_plan_id: planId,
              product_id: adj.product_id,
              product_quantity: adj.quantity,
            },
          });
        }
      }
    });
    
    const updatedPlan = await this.subscription_plan.findUniqueOrThrow({ 
        where: { subscription_plan_id: planId }, 
        include: { subscription_plan_product: { include: { product: true } } }
    });
    return this.toSubscriptionPlanResponseDto(updatedPlan);
  }

  async adjustAllPlansPrice(dto: AdjustAllPlansPriceDto): Promise<{ updated_count: number; message: string }> {
    const { percentage, fixedAmount } = dto;

    if ((percentage === undefined || percentage === null) && (fixedAmount === undefined || fixedAmount === null)) {
      throw new BadRequestException('Debe proporcionar un \'percentage\' o un \'fixedAmount\'.');
    }
    if (percentage !== undefined && percentage !== null && fixedAmount !== undefined && fixedAmount !== null) {
      throw new BadRequestException('No puede proporcionar \'percentage\' y \'fixedAmount\' simultáneamente.');
    }

    const plansToUpdate = await this.subscription_plan.findMany({});
    let updatedCount = 0;

    for (const plan of plansToUpdate) {
      let newPriceDecimal: Decimal | null = null;
      if (plan.price === null) continue; 

      const currentPrice = new Decimal(plan.price);

      if (percentage !== undefined && percentage !== null) {
        const changeFactor = new Decimal(percentage).div(100);
        newPriceDecimal = currentPrice.plus(currentPrice.mul(changeFactor));
      } else if (fixedAmount !== undefined && fixedAmount !== null) {
        newPriceDecimal = currentPrice.plus(new Decimal(fixedAmount));
      }

      if (newPriceDecimal !== null && newPriceDecimal.isNegative()) {
        console.warn(`El ajuste para el plan ${plan.name} (ID: ${plan.subscription_plan_id}) resultaría en un precio negativo (${newPriceDecimal?.toFixed(2)}). Se omitirá la actualización de este plan.`);
        continue;
      }
      
      if (newPriceDecimal !== null) {
        try {
            await this.subscription_plan.update({
              where: { subscription_plan_id: plan.subscription_plan_id },
              data: { price: newPriceDecimal.toDecimalPlaces(2) }, 
            });
            updatedCount++;
        } catch (error) {
            // Podríamos querer manejar errores por plan individual aquí, o dejar que falle la operación completa.
            // Por ahora, solo logueamos y continuamos, lo que significa que algunos planes podrían no actualizarse si hay un error.
            console.error(`Error al actualizar el precio del ${this.entityName.toLowerCase()} ${plan.name} (ID: ${plan.subscription_plan_id}):`, error);
            // Considerar si se debe relanzar el error o añadirlo a una lista de errores para devolver.
        }
      }
    }

    return {
      updated_count: updatedCount,
      message: `Se actualizaron los precios de ${updatedCount} planes de suscripción.`,
    };
  }
} 