import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, OnModuleInit, BadRequestException } from '@nestjs/common';
import { PrismaClient, subscription_plan as SubscriptionPlanPrisma, Prisma, SubscriptionStatus } from '@prisma/client';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { AddProductToPlanDto } from './dto/add-product-to-plan.dto';
import { UpdateProductInPlanDto } from './dto/update-product-in-plan.dto';
import { AdjustPlanProductQuantitiesDto, RoundingStrategy } from './dto/adjust-plan-product-quantities.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { AdjustAllPlansPriceDto } from './dto';

@Injectable()
export class SubscriptionPlansService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async create(createSubscriptionPlanDto: CreateSubscriptionPlanDto): Promise<SubscriptionPlanPrisma> {
    try {
      return await this.subscription_plan.create({
        data: {
          name: createSubscriptionPlanDto.name,
          description: createSubscriptionPlanDto.description,
          price: createSubscriptionPlanDto.price
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') { 
          throw new ConflictException(
            `Conflicto al crear el plan de suscripción. Verifique que no haya campos duplicados que deban ser únicos.`,
          );
        }
      }
      console.error("Error creating subscription plan: ", error);
      throw new InternalServerErrorException('Error al crear el plan de suscripción.');
    }
  }

  async findAll(): Promise<SubscriptionPlanPrisma[]> {
    return this.subscription_plan.findMany({
      include: {
        subscription_plan_product: { 
          include: {
            product: true, 
          },
        },
      },
    });
  }

  async findOne(id: number): Promise<SubscriptionPlanPrisma> {
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
      throw new NotFoundException(`Plan de suscripción con ID ${id} no encontrado.`);
    }
    return plan;
  }

  async update(id: number, updateSubscriptionPlanDto: UpdateSubscriptionPlanDto): Promise<SubscriptionPlanPrisma> {
    await this.findOne(id); // Verificar que existe
    try {
      return await this.subscription_plan.update({
        where: { subscription_plan_id: id },
        data: updateSubscriptionPlanDto,
      });
    } catch (error) {
        // Aquí P2002 sería si el DTO intenta cambiar `name` a uno que ya existe y `name` es único.
        // Dado que `name` no es único en el schema, P2002 no debería ocurrir por `name`.
        // Si `subscription_plan_id` se pudiera cambiar y causara conflicto, P2002 aplicaría.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
             throw new ConflictException(`Error de conflicto al actualizar el plan. Verifique los datos.`);
        }
        console.error(`Error updating subscription plan ${id}: `, error);
      throw new InternalServerErrorException(`Error al actualizar el plan de suscripción con ID ${id}.`);
    }
  }

  async remove(id: number): Promise<{ message: string }> {
    await this.findOne(id); // Verificar que existe

    const activeCustomerSubscriptions = await this.customer_subscription.count({
      where: {
        subscription_plan_id: id,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED] } 
      },
    });

    if (activeCustomerSubscriptions > 0) {
      throw new ConflictException(
        `El plan de suscripción con ID ${id} no puede ser eliminado porque tiene ${activeCustomerSubscriptions} suscripciones de clientes asociadas activas o pausadas. Considere cancelarlas primero.`,
      );
    }

    // Eliminar primero los productos asociados al plan en subscription_plan_product
    await this.subscription_plan_product.deleteMany({
        where: { subscription_plan_id: id }
    });
    
    // Luego eliminar el plan en sí
    await this.subscription_plan.delete({
      where: { subscription_plan_id: id },
    });
    return { message: `Plan de suscripción con ID ${id} y sus productos asociados eliminados correctamente.` };
  }

  async addProductToPlan(planId: number, addProductToPlanDto: AddProductToPlanDto): Promise<SubscriptionPlanPrisma> {
    // Verificar que el plan existe
    await this.findOne(planId);

    // Verificar que el producto existe
    const product = await this.product.findUnique({ where: { product_id: addProductToPlanDto.product_id } });
    if (!product) {
      throw new NotFoundException(`Producto con ID ${addProductToPlanDto.product_id} no encontrado.`);
    }

    // Verificar si el producto ya está en el plan
    const existingProductInPlan = await this.subscription_plan_product.findFirst({
      where: {
        subscription_plan_id: planId,
        product_id: addProductToPlanDto.product_id,
      },
    });

    if (existingProductInPlan) {
      throw new ConflictException(
        `El producto con ID ${addProductToPlanDto.product_id} ya existe en el plan de suscripción con ID ${planId}.`,
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
      // Devolver el plan actualizado con todos sus productos
      return this.findOne(planId);
    } catch (error) {
      console.error(`Error adding product to plan ${planId}: `, error);
      throw new InternalServerErrorException('Error al añadir producto al plan de suscripción.');
    }
  }

  async updateProductInPlan(planId: number, productId: number, updateProductInPlanDto: UpdateProductInPlanDto): Promise<SubscriptionPlanPrisma> {
    // Verificar que el plan existe
    await this.findOne(planId);
    // Verificar que el producto existe
     const product = await this.product.findUnique({ where: { product_id: productId } });
    if (!product) {
      throw new NotFoundException(`Producto con ID ${productId} no encontrado.`);
    }

    // Verificar que la asociación producto-plan existe
    const existingEntry = await this.subscription_plan_product.findFirst({
      where: {
        subscription_plan_id: planId,
        product_id: productId,
      },
    });

    if (!existingEntry) {
      throw new NotFoundException(
        `Producto con ID ${productId} no encontrado en el plan de suscripción ID ${planId}.`,
      );
    }

    try {
      await this.subscription_plan_product.update({
        where: {
          spp_id: existingEntry.spp_id // Usar el ID de la tabla de unión
        },
        data: {
          product_quantity: updateProductInPlanDto.product_quantity,
        },
      });
      return this.findOne(planId);
    } catch (error) {
      console.error(`Error updating product ${productId} in plan ${planId}: `, error);
      throw new InternalServerErrorException('Error al actualizar producto en el plan de suscripción.');
    }
  }

  async removeProductFromPlan(planId: number, productId: number): Promise<SubscriptionPlanPrisma> {
    // Verificar que el plan existe
    await this.findOne(planId);
     // Verificar que el producto existe (opcional, pero bueno para un mensaje claro si el ID de producto es incorrecto)
    const product = await this.product.findUnique({ where: { product_id: productId } });
    if (!product) {
      throw new NotFoundException(`Producto con ID ${productId} no encontrado (no se puede eliminar de un plan si el producto en sí no existe).`);
    }

    // Verificar que la asociación producto-plan existe para obtener su ID
    const existingEntry = await this.subscription_plan_product.findFirst({
      where: {
        subscription_plan_id: planId,
        product_id: productId,
      },
    });

    if (!existingEntry) {
      throw new NotFoundException(
        `Producto con ID ${productId} no se pudo encontrar en el plan de suscripción ID ${planId} para eliminar.`,
      );
    }
    
    try {
      await this.subscription_plan_product.delete({
        where: { 
            spp_id: existingEntry.spp_id // Usar el ID de la tabla de unión
        },
      });
      return this.findOne(planId); // Devolver el plan actualizado
    } catch (error) {
      console.error(`Error removing product ${productId} from plan ${planId}: `, error);
      throw new InternalServerErrorException('Error al eliminar producto del plan de suscripción.');
    }
  }

  async adjustProductQuantitiesInPlan(planId: number, dto: AdjustPlanProductQuantitiesDto): Promise<SubscriptionPlanPrisma> {
    // Consultar el plan con sus productos directamente aquí para ayudar al linter con la inferencia de tipos
    const planWithProducts = await this.subscription_plan.findUnique({
      where: { subscription_plan_id: planId },
      include: {
        subscription_plan_product: {
          include: {
            product: true, // Es bueno tener los detalles del producto por si se necesitaran
          },
        },
      },
    });

    if (!planWithProducts) {
      throw new NotFoundException(`Plan de suscripción con ID ${planId} no encontrado.`);
    }

    // Acceder a la relación a través de la variable local planWithProducts
    if (!planWithProducts.subscription_plan_product || planWithProducts.subscription_plan_product.length === 0) {
      return planWithProducts; 
    }

    const { percentage_change, rounding_strategy } = dto;
    const factor = new Decimal(1).plus(new Decimal(percentage_change).dividedBy(100));

    if (factor.isNegative() || factor.isZero()) {
        throw new BadRequestException('El cambio porcentual resultaría en cantidades no positivas o cero, lo cual no es permitido. Use un porcentaje que mantenga cantidades positivas.');
    }

    return this.$transaction(async (tx) => {
      for (const spp of planWithProducts.subscription_plan_product) { // Usar planWithProducts aquí
        const originalQuantity = new Decimal(spp.product_quantity);
        let newQuantityDecimal = originalQuantity.mul(factor);

        let newQuantityInt: number;
        switch (rounding_strategy) {
          case RoundingStrategy.CEIL:
            newQuantityInt = newQuantityDecimal.ceil().toNumber();
            break;
          case RoundingStrategy.FLOOR:
            newQuantityInt = newQuantityDecimal.floor().toNumber();
            break;
          case RoundingStrategy.ROUND:
          default:
            newQuantityInt = newQuantityDecimal.round().toNumber();
            break;
        }

        if (newQuantityInt < 1) {
          newQuantityInt = 1;
        }

        await tx.subscription_plan_product.update({
          where: { spp_id: spp.spp_id },
          data: { product_quantity: newQuantityInt },
        });
      }
      
      // Devolver el plan actualizado usando el cliente de transacción
      const updatedPlan = await tx.subscription_plan.findUniqueOrThrow({
        where: { subscription_plan_id: planId },
        include: {
          subscription_plan_product: {
            include: {
              product: true,
            },
          },
        },
      });
      return updatedPlan;
    });
  }

  async adjustAllPlanPrices(dto: AdjustAllPlansPriceDto): Promise<{ updated_count: number; message: string }> {
    const { percentage_change } = dto;
    const factor = new Decimal(1).plus(new Decimal(percentage_change).dividedBy(100));

    if (factor.isNegative()) {
      throw new BadRequestException('El cambio porcentual no puede resultar en un factor negativo.');
    }

    // Obtener todos los planes que tienen un precio establecido
    const plansToUpdate = await this.subscription_plan.findMany({
      where: {
        price: { not: null }, // Solo actualizar planes que tengan un precio base
      },
    });

    if (plansToUpdate.length === 0) {
      return { updated_count: 0, message: 'No hay planes con precios fijos para actualizar.' };
    }

    let updatedCount = 0;

    return this.$transaction(async (tx) => {
      for (const plan of plansToUpdate) {
        if (plan.price) { // Doble verificación, aunque el findMany ya filtra
          const originalPrice = new Decimal(plan.price);
          let newPriceDecimal = originalPrice.mul(factor);

          // Redondear a 2 decimales. Si el precio se vuelve negativo, se podría establecer a 0 o lanzar error.
          // Por ahora, permitiremos precios negativos si el factor es muy bajo, pero un precio negativo no tiene sentido.
          // Idealmente, si newPriceDecimal < 0, newPriceDecimal = 0 o lanzar error.
          // Para simplificar, si el factor es positivo, el precio no se volverá negativo a menos que originalPrice sea negativo.
          if (newPriceDecimal.isNegative()) {
            // Opcional: decidir si lanzar un error o establecer a 0
            // console.warn(`El nuevo precio calculado para el plan ${plan.subscription_plan_id} es negativo (${newPriceDecimal.toFixed(2)}). Se establecerá a 0.`);
            // newPriceDecimal = new Decimal(0);
            // O lanzar un error:
            throw new BadRequestException(`El ajuste resultaría en un precio negativo para el plan ${plan.name} (ID: ${plan.subscription_plan_id}).`);
          }

          const newPriceFixed = newPriceDecimal.toFixed(2); // Redondeo a 2 decimales y convierte a string para guardar

          await tx.subscription_plan.update({
            where: { subscription_plan_id: plan.subscription_plan_id },
            data: { price: newPriceFixed },
          });
          updatedCount++;
        }
      }
      return {
        updated_count: updatedCount,
        message: `${updatedCount} planes de suscripción han sido actualizados con un ${percentage_change}% de cambio en sus precios.`,
      };
    });
  }
} 