import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class SubscriptionCycleCalculatorService {
  private readonly logger = new Logger(SubscriptionCycleCalculatorService.name);

  constructor(private readonly prisma: PrismaService) {}

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

      const planPrice = cycle.customer_subscription.subscription_plan.price;
      const totalAmount = planPrice ? new Decimal(planPrice) : new Decimal(0);

      // CORRECIÓN: Validar que el plan tenga precio definido
      if (!planPrice || totalAmount.equals(0)) {
        this.logger.error(
          `❌ PROBLEMA: Plan de suscripción "${cycle.customer_subscription.subscription_plan.name}" (ID: ${cycle.customer_subscription.subscription_plan_id}) NO tiene precio definido.`,
        );
        this.logger.error(
          `❌ Se debe asignar un precio al plan de suscripción para calcular correctamente los ciclos.`,
        );
        this.logger.error(
          `❌ EVITANDO cálculo por productos - esto causaría facturación incorrecta.`,
        );

        throw new Error(
          `El plan de suscripción "${cycle.customer_subscription.subscription_plan.name}" debe tener un precio definido. ` +
            `Los ciclos deben calcularse basándose en el precio del plan, no en la suma de productos individuales.`,
        );
      }

      this.logger.log(
        `✅ Usando precio del plan de suscripción: ${totalAmount} (Plan: ${cycle.customer_subscription.subscription_plan.name})`,
      );

      // Los planes DEBEN tener precio definido - no se calcula por productos

      // Actualizar el ciclo con el total calculado
      await this.prisma.subscription_cycle.update({
        where: { cycle_id: cycleId },
        data: {
          total_amount: totalAmount,
          pending_balance: totalAmount.minus(cycle.paid_amount || 0),
        },
      });

      this.logger.log(`Total calculado para ciclo ${cycleId}: ${totalAmount}`);
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
        OR: [{ total_amount: null }, { total_amount: 0 }],
      },
      select: {
        cycle_id: true,
      },
    });

    this.logger.log(`Encontrados ${pendingCycles.length} ciclos pendientes`);

    const cycleIds = pendingCycles.map((cycle) => cycle.cycle_id);
    await this.calculateMultipleCycles(cycleIds);

    return pendingCycles.length;
  }

  /**
   * Valida que todos los planes de suscripción activos tengan precio definido
   */
  async validateAllPlansHavePrices(): Promise<{
    valid: boolean;
    plansWithoutPrice: Array<{ id: number; name: string }>;
  }> {
    this.logger.log('Validando que todos los planes tengan precios definidos');

    const plansWithoutPrice = await this.prisma.subscription_plan.findMany({
      where: {
        is_active: true,
        OR: [{ price: null }, { price: 0 }],
      },
      select: {
        subscription_plan_id: true,
        name: true,
        price: true,
      },
    });

    if (plansWithoutPrice.length > 0) {
      this.logger.warn(
        `❌ Encontrados ${plansWithoutPrice.length} planes sin precio definido:`,
      );

      plansWithoutPrice.forEach((plan) => {
        this.logger.warn(
          `   • Plan "${plan.name}" (ID: ${plan.subscription_plan_id}) - Precio: ${plan.price}`,
        );
      });

      return {
        valid: false,
        plansWithoutPrice: plansWithoutPrice.map((p) => ({
          id: p.subscription_plan_id,
          name: p.name,
        })),
      };
    }

    this.logger.log('✅ Todos los planes activos tienen precios definidos');
    return {
      valid: true,
      plansWithoutPrice: [],
    };
  }

  /**
   * Obtiene información sobre planes que están siendo usados en suscripciones activas pero no tienen precio
   */
  async getActivePlansWithoutPrice(): Promise<
    Array<{
      plan_id: number;
      plan_name: string;
      active_subscriptions_count: number;
    }>
  > {
    const plansInUse = await this.prisma.subscription_plan.findMany({
      where: {
        customer_subscription: {
          some: {
            status: 'ACTIVE',
          },
        },
        OR: [{ price: null }, { price: 0 }],
      },
      include: {
        _count: {
          select: {
            customer_subscription: {
              where: {
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    });

    return plansInUse.map((plan) => ({
      plan_id: plan.subscription_plan_id,
      plan_name: plan.name,
      active_subscriptions_count: plan._count.customer_subscription,
    }));
  }

  /**
   * Recalcula un ciclo específico con el precio correcto del plan
   * Útil para corregir ciclos que se calcularon incorrectamente por productos
   */
  async recalculateSpecificCycle(cycleId: number): Promise<{
    cycle_id: number;
    old_total: number;
    new_total: number;
    corrected: boolean;
    message: string;
  }> {
    this.logger.log(`🔄 Recalculando ciclo ${cycleId} con precio del plan`);

    try {
      // Obtener el ciclo actual
      const cycle = await this.prisma.subscription_cycle.findUnique({
        where: { cycle_id: cycleId },
        include: {
          customer_subscription: {
            include: {
              subscription_plan: true,
            },
          },
        },
      });

      if (!cycle) {
        throw new Error(`Ciclo con ID ${cycleId} no encontrado`);
      }

      const oldTotal = Number(cycle.total_amount || 0);
      const planPrice = cycle.customer_subscription.subscription_plan.price;

      if (!planPrice || Number(planPrice) <= 0) {
        throw new Error(
          `El plan "${cycle.customer_subscription.subscription_plan.name}" no tiene precio definido`,
        );
      }

      const newTotal = Number(planPrice);
      const paidAmount = Number(cycle.paid_amount || 0);
      const newPendingBalance = Math.max(0, newTotal - paidAmount);

      // Actualizar el ciclo
      await this.prisma.subscription_cycle.update({
        where: { cycle_id: cycleId },
        data: {
          total_amount: planPrice,
          pending_balance: newPendingBalance,
        },
      });

      const corrected = oldTotal !== newTotal;

      this.logger.log(
        `✅ Ciclo ${cycleId} recalculado: ${oldTotal} → ${newTotal} (${corrected ? 'CORREGIDO' : 'SIN CAMBIOS'})`,
      );

      return {
        cycle_id: cycleId,
        old_total: oldTotal,
        new_total: newTotal,
        corrected,
        message: corrected
          ? `Ciclo corregido: total actualizado de ${oldTotal} a ${newTotal}`
          : `Ciclo ya tenía el total correcto: ${newTotal}`,
      };
    } catch (error) {
      this.logger.error(`❌ Error recalculando ciclo ${cycleId}:`, error);
      throw error;
    }
  }

  /**
   * Encuentra y recalcula ciclos que tienen cálculos incorrectos
   * (donde total_amount != precio del plan)
   */
  async findAndFixIncorrectCycles(): Promise<{
    total_cycles_checked: number;
    cycles_corrected: number;
    corrections: Array<{
      cycle_id: number;
      subscription_id: number;
      plan_name: string;
      old_total: number;
      new_total: number;
    }>;
  }> {
    this.logger.log('🔍 Buscando ciclos con cálculos incorrectos...');

    // Obtener todos los ciclos con sus planes
    const cycles = await this.prisma.subscription_cycle.findMany({
      where: {
        customer_subscription: {
          status: 'ACTIVE',
          subscription_plan: {
            price: { not: null },
          },
        },
      },
      include: {
        customer_subscription: {
          include: {
            subscription_plan: true,
          },
        },
      },
    });

    const corrections = [];
    let cyclesCorrected = 0;

    for (const cycle of cycles) {
      const currentTotal = Number(cycle.total_amount || 0);
      const correctTotal = Number(
        cycle.customer_subscription.subscription_plan.price,
      );

      // Si el total actual difiere del precio del plan, corregir
      if (currentTotal !== correctTotal) {
        try {
          const result = await this.recalculateSpecificCycle(cycle.cycle_id);

          if (result.corrected) {
            corrections.push({
              cycle_id: cycle.cycle_id,
              subscription_id: cycle.subscription_id,
              plan_name: cycle.customer_subscription.subscription_plan.name,
              old_total: result.old_total,
              new_total: result.new_total,
            });
            cyclesCorrected++;
          }
        } catch (error) {
          this.logger.error(
            `Error corrigiendo ciclo ${cycle.cycle_id}:`,
            error.message,
          );
        }
      }
    }

    this.logger.log(
      `🎯 Revisión completada: ${cycles.length} ciclos verificados, ${cyclesCorrected} corregidos`,
    );

    return {
      total_cycles_checked: cycles.length,
      cycles_corrected: cyclesCorrected,
      corrections,
    };
  }
}
