import { Injectable, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma, SubscriptionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface ProductQuotaInfo {
  product_id: number;
  product_description: string;
  planned_quantity: number;
  delivered_quantity: number;
  remaining_balance: number;
  requested_quantity: number;
  covered_by_subscription: number;  // Cantidad cubierta por suscripción (precio $0)
  additional_quantity: number;      // Cantidad adicional que debe pagar
}

export interface SubscriptionQuotaValidation {
  subscription_id: number;
  current_cycle_id: number;
  products: ProductQuotaInfo[];
  has_additional_charges: boolean;
}

@Injectable()
export class SubscriptionQuotaService extends PrismaClient implements OnModuleInit {
  
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Obtiene el ciclo actual activo para una suscripción
   */
  private async getCurrentActiveCycle(subscriptionId: number, tx?: Prisma.TransactionClient) {
    const prisma = tx || this;
    const today = new Date();
    
    return await prisma.subscription_cycle.findFirst({
      where: {
        subscription_id: subscriptionId,
        cycle_start: { lte: today },
        cycle_end: { gte: today }
      },
      include: {
        subscription_cycle_detail: {
          include: {
            product: true
          }
        }
      },
      orderBy: { cycle_start: 'desc' }
    });
  }

  /**
   * Crea un nuevo ciclo si no existe uno activo
   */
  private async createNewCycleIfNeeded(subscriptionId: number, tx?: Prisma.TransactionClient) {
    const prisma = tx || this;
    
    // Obtener suscripción con su plan
    const subscription = await prisma.customer_subscription.findUnique({
      where: { subscription_id: subscriptionId },
      include: {
        subscription_plan: {
          include: {
            subscription_plan_product: {
              include: { product: true }
            }
          }
        }
      }
    });

    if (!subscription) {
      throw new NotFoundException(`Suscripción con ID ${subscriptionId} no encontrada.`);
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException(`La suscripción con ID ${subscriptionId} no está activa.`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calcular fechas del nuevo ciclo
    const cycleStart = new Date(today);
    const cycleEnd = new Date(today);
    cycleEnd.setDate(cycleStart.getDate() + (subscription.subscription_plan.default_cycle_days || 30));
    cycleEnd.setHours(23, 59, 59, 999);

    // Crear el nuevo ciclo
    const newCycle = await prisma.subscription_cycle.create({
      data: {
        subscription_id: subscriptionId,
        cycle_start: cycleStart,
        cycle_end: cycleEnd,
        notes: 'Ciclo creado automáticamente por sistema de cuotas'
      }
    });

    // Crear los detalles del ciclo con las cantidades planificadas
    for (const planProduct of subscription.subscription_plan.subscription_plan_product) {
      await prisma.subscription_cycle_detail.create({
        data: {
          cycle_id: newCycle.cycle_id,
          product_id: planProduct.product_id,
          planned_quantity: planProduct.product_quantity,
          delivered_quantity: 0,
          remaining_balance: planProduct.product_quantity
        }
      });
    }

    // Recargar el ciclo con todas las relaciones necesarias
    return await prisma.subscription_cycle.findUnique({
      where: { cycle_id: newCycle.cycle_id },
      include: {
        subscription_cycle_detail: {
          include: {
            product: true
          }
        }
      }
    });
  }

  /**
   * Valida las cuotas de suscripción para una orden y calcula qué productos son adicionales
   */
  async validateSubscriptionQuotas(
    subscriptionId: number, 
    requestedProducts: { product_id: number; quantity: number }[],
    tx?: Prisma.TransactionClient
  ): Promise<SubscriptionQuotaValidation> {
    const prisma = tx || this;

    // Obtener o crear ciclo actual
    let currentCycle = await this.getCurrentActiveCycle(subscriptionId, prisma);
    
    if (!currentCycle) {
      currentCycle = await this.createNewCycleIfNeeded(subscriptionId, prisma);
      // Recargar con los detalles
      currentCycle = await this.getCurrentActiveCycle(subscriptionId, prisma);
    }

    if (!currentCycle) {
      throw new BadRequestException(`No se pudo obtener o crear un ciclo activo para la suscripción ${subscriptionId}.`);
    }

    const productQuotas: ProductQuotaInfo[] = [];
    let hasAdditionalCharges = false;

    for (const requestedProduct of requestedProducts) {
      const cycleDetail = currentCycle.subscription_cycle_detail.find(
        detail => detail.product_id === requestedProduct.product_id
      );

      if (cycleDetail) {
        // Producto está en el plan de suscripción
        const availableBalance = Math.max(0, cycleDetail.remaining_balance);
        const coveredBySubscription = Math.min(requestedProduct.quantity, availableBalance);
        const additionalQuantity = Math.max(0, requestedProduct.quantity - coveredBySubscription);

        if (additionalQuantity > 0) {
          hasAdditionalCharges = true;
        }

        productQuotas.push({
          product_id: requestedProduct.product_id,
          product_description: cycleDetail.product.description,
          planned_quantity: cycleDetail.planned_quantity,
          delivered_quantity: cycleDetail.delivered_quantity,
          remaining_balance: cycleDetail.remaining_balance,
          requested_quantity: requestedProduct.quantity,
          covered_by_subscription: coveredBySubscription,
          additional_quantity: additionalQuantity
        });
      } else {
        // Producto NO está en el plan → todo es adicional
        const product = await prisma.product.findUnique({
          where: { product_id: requestedProduct.product_id }
        });

        productQuotas.push({
          product_id: requestedProduct.product_id,
          product_description: product?.description || 'Producto no encontrado',
          planned_quantity: 0,
          delivered_quantity: 0,
          remaining_balance: 0,
          requested_quantity: requestedProduct.quantity,
          covered_by_subscription: 0,
          additional_quantity: requestedProduct.quantity
        });

        hasAdditionalCharges = true;
      }
    }

    return {
      subscription_id: subscriptionId,
      current_cycle_id: currentCycle.cycle_id,
      products: productQuotas,
      has_additional_charges: hasAdditionalCharges
    };
  }

  /**
   * Actualiza las cantidades entregadas cuando una orden se confirma/entrega
   */
  async updateDeliveredQuantities(
    subscriptionId: number,
    deliveredProducts: { product_id: number; quantity: number }[],
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const prisma = tx || this;

    const currentCycle = await this.getCurrentActiveCycle(subscriptionId, prisma);
    if (!currentCycle) {
      throw new BadRequestException(`No hay un ciclo activo para la suscripción ${subscriptionId}.`);
    }

    for (const deliveredProduct of deliveredProducts) {
      const cycleDetail = currentCycle.subscription_cycle_detail.find(
        detail => detail.product_id === deliveredProduct.product_id
      );

      if (cycleDetail) {
        // Solo actualizar productos que están en el plan
        const newDeliveredQuantity = cycleDetail.delivered_quantity + deliveredProduct.quantity;
        const newRemainingBalance = Math.max(0, cycleDetail.planned_quantity - newDeliveredQuantity);

        await prisma.subscription_cycle_detail.update({
          where: { cycle_detail_id: cycleDetail.cycle_detail_id },
          data: {
            delivered_quantity: newDeliveredQuantity,
            remaining_balance: newRemainingBalance
          }
        });
      }
    }
  }

  /**
   * Obtiene el resumen de créditos disponibles para un cliente
   */
  async getAvailableCredits(subscriptionId: number): Promise<ProductQuotaInfo[]> {
    const currentCycle = await this.getCurrentActiveCycle(subscriptionId);
    
    if (!currentCycle) {
      return [];
    }

    return currentCycle.subscription_cycle_detail.map(detail => ({
      product_id: detail.product_id,
      product_description: detail.product.description,
      planned_quantity: detail.planned_quantity,
      delivered_quantity: detail.delivered_quantity,
      remaining_balance: detail.remaining_balance,
      requested_quantity: 0,
      covered_by_subscription: 0,
      additional_quantity: 0
    }));
  }
} 