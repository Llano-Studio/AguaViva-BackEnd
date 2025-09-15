import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class SubscriptionCycleCalculatorService {
  private readonly logger = new Logger(SubscriptionCycleCalculatorService.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Calcula y actualiza el total_amount de un ciclo de suscripción
   * basado en los productos del plan y las listas de precios
   */
  async calculateAndUpdateCycleAmount(cycleId: number): Promise<void> {
    this.logger.log(`Calculando total_amount para ciclo ${cycleId}`);

    try {
      // Obtener el ciclo con su suscripción y plan
      const cycle = await this.prisma.subscription_cycle.findUnique({
        where: { cycle_id: cycleId },
        include: {
          customer_subscription: {
            include: {
              subscription_plan: {
                include: {
                  subscription_plan_product: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
              person: {
                include: {
                  locality: true,
                },
              },
            },
          },
        },
      });

      if (!cycle) {
        throw new Error(`Ciclo con ID ${cycleId} no encontrado`);
      }

      // Calcular el total basado en los productos del plan
      let totalAmount = new Decimal(0);
      const planProducts = cycle.customer_subscription.subscription_plan.subscription_plan_product;

      for (const planProduct of planProducts) {
        const productPrice = await this.getProductPrice(
          planProduct.product_id,
          cycle.customer_subscription.person.locality?.locality_id,
        );

        if (productPrice) {
          const subtotal = productPrice.mul(planProduct.product_quantity);
          totalAmount = totalAmount.plus(subtotal);
          
          this.logger.log(
            `Producto ${planProduct.product.description}: ${planProduct.product_quantity} x ${productPrice} = ${subtotal}`,
          );
        } else {
          this.logger.warn(
            `No se encontró precio para producto ${planProduct.product_id}`,
          );
        }
      }

      // Actualizar el ciclo con el total calculado
      await this.prisma.subscription_cycle.update({
        where: { cycle_id: cycleId },
        data: {
          total_amount: totalAmount,
          pending_balance: totalAmount.minus(cycle.paid_amount || 0),
        },
      });

      this.logger.log(
        `Total calculado para ciclo ${cycleId}: ${totalAmount}`,
      );
    } catch (error) {
      this.logger.error(
        `Error calculando total_amount para ciclo ${cycleId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Obtiene el precio de un producto para una localidad específica
   */
  private async getProductPrice(
    productId: number,
    localityId?: number,
  ): Promise<Decimal | null> {
    try {
      // Buscar precio específico para la localidad
      if (localityId) {
        const localityPrice = await this.prisma.price_list_item.findFirst({
          where: {
            product_id: productId,
            price_list: {
              is_active: true,
            },
          },
          include: {
            price_list: true,
          },
          orderBy: {
            price_list: {
              created_at: 'desc',
            },
          },
        });

        if (localityPrice) {
          return localityPrice.unit_price;
        }
      }

      // Si no hay precio específico, buscar precio general (sin localidad)
      const generalPrice = await this.prisma.price_list_item.findFirst({
        where: {
          product_id: productId,
          price_list: {
            is_active: true,
          },
        },
        include: {
          price_list: true,
        },
        orderBy: {
          price_list: {
            created_at: 'desc',
          },
        },
      });

      return generalPrice?.unit_price || null;
    } catch (error) {
      this.logger.error(
        `Error obteniendo precio para producto ${productId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Calcula el total para múltiples ciclos
   */
  async calculateMultipleCycles(cycleIds: number[]): Promise<void> {
    this.logger.log(`Calculando totales para ${cycleIds.length} ciclos`);

    for (const cycleId of cycleIds) {
      try {
        await this.calculateAndUpdateCycleAmount(cycleId);
      } catch (error) {
        this.logger.error(
          `Error calculando ciclo ${cycleId}, continuando con el siguiente`,
          error,
        );
      }
    }
  }

  /**
   * Calcula totales para todos los ciclos con total_amount = 0 o NULL
   */
  async calculateAllPendingCycles(): Promise<number> {
    this.logger.log('Buscando ciclos con total_amount pendiente de cálculo');

    const pendingCycles = await this.prisma.subscription_cycle.findMany({
      where: {
        OR: [
          { total_amount: null },
          { total_amount: 0 },
        ],
      },
      select: {
        cycle_id: true,
      },
    });

    this.logger.log(`Encontrados ${pendingCycles.length} ciclos pendientes`);

    const cycleIds = pendingCycles.map(cycle => cycle.cycle_id);
    await this.calculateMultipleCycles(cycleIds);

    return pendingCycles.length;
  }
}