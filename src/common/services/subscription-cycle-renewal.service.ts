import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient, SubscriptionStatus } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionCycleNumberingService } from './subscription-cycle-numbering.service';
import { SubscriptionCycleCalculatorService } from './subscription-cycle-calculator.service';

@Injectable()
export class SubscriptionCycleRenewalService
  extends PrismaClient
  implements OnModuleInit
{
  private readonly logger = new Logger(SubscriptionCycleRenewalService.name);

  constructor(
    private readonly cycleNumberingService: SubscriptionCycleNumberingService,
    private readonly cycleCalculatorService: SubscriptionCycleCalculatorService,
  ) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('SubscriptionCycleRenewalService initialized');
  }

  /**
   * Ejecuta la renovación de ciclos expirados y verificación de recargos cada día a la 1 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async renewExpiredCycles() {
    await this.checkAndApplyLateFees();
    this.logger.log(
      '🔄 Iniciando renovación automática de ciclos de suscripción...',
    );

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Buscar suscripciones activas cuyos ciclos actuales han expirado
      const expiredCycles = await this.subscription_cycle.findMany({
        where: {
          cycle_end: {
            lt: today, // Ciclos que terminaron antes de hoy
          },
          customer_subscription: {
            status: SubscriptionStatus.ACTIVE,
          },
        },
        include: {
          customer_subscription: {
            include: {
              subscription_plan: {
                include: {
                  subscription_plan_product: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(
        `📊 Encontrados ${expiredCycles.length} ciclos expirados para renovar`,
      );

      for (const expiredCycle of expiredCycles) {
        await this.createNewCycleForSubscription(
          expiredCycle.customer_subscription,
        );
      }

      this.logger.log('✅ Renovación automática de ciclos completada');
    } catch (error) {
      this.logger.error(
        '❌ Error durante la renovación automática de ciclos:',
        error,
      );
    }
  }

  /**
   * Crea un nuevo ciclo para una suscripción específica usando CycleNumberingService
   */
  private async createNewCycleForSubscription(subscription: any) {
    try {
      // Calcular fechas del nuevo ciclo (un mes desde hoy)
      const cycleStartDate = new Date();
      cycleStartDate.setHours(0, 0, 0, 0);

      const cycleEndDate = new Date(cycleStartDate);
      cycleEndDate.setMonth(cycleStartDate.getMonth() + 1);
      cycleEndDate.setDate(cycleStartDate.getDate() - 1);
      cycleEndDate.setHours(23, 59, 59, 999);

      // Calcular fecha de vencimiento de pago (10 días después del final del ciclo)
      const paymentDueDate = new Date(cycleEndDate);
      paymentDueDate.setDate(paymentDueDate.getDate() + 10);

      // Crear el nuevo ciclo usando CycleNumberingService para numeración correcta
      const newCycle = await this.cycleNumberingService.createCycleWithNumber(
        subscription.subscription_id,
        {
          cycle_start: cycleStartDate,
          cycle_end: cycleEndDate,
          payment_due_date: paymentDueDate,
          total_amount: 0, // Se calculará después
        },
      );

      // Crear los detalles del ciclo basados en el plan de suscripción
      for (const planProduct of subscription.subscription_plan
        .subscription_plan_product) {
        await this.subscription_cycle_detail.create({
          data: {
            cycle_id: newCycle.cycle_id,
            product_id: planProduct.product_id,
            planned_quantity: planProduct.product_quantity,
            delivered_quantity: 0,
            remaining_balance: planProduct.product_quantity,
          },
        });
      }

      // Calcular el total_amount del ciclo basado en los productos del plan
      try {
        await this.cycleCalculatorService.calculateAndUpdateCycleAmount(
          newCycle.cycle_id,
        );
        this.logger.log(
          `✅ Total calculado para ciclo renovado ${newCycle.cycle_id}`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Error calculando total para ciclo renovado ${newCycle.cycle_id}:`,
          error,
        );
      }

      this.logger.log(
        `✅ Nuevo ciclo creado para suscripción ${subscription.subscription_id}: ` +
          `${cycleStartDate.toISOString().split('T')[0]} - ${cycleEndDate.toISOString().split('T')[0]}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error creando nuevo ciclo para suscripción ${subscription.subscription_id}:`,
        error,
      );
    }
  }

  /**
   * Verifica y aplica recargos por mora a ciclos vencidos
   */
  async checkAndApplyLateFees() {
    this.logger.log(
      '💰 Verificando ciclos vencidos para aplicar recargos por mora...',
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Umbral de 10 días después de la fecha de vencimiento
    const thresholdDate = new Date(today);
    thresholdDate.setDate(thresholdDate.getDate() - 10);

    try {
      // Buscar ciclos que han pasado 10 días desde la fecha de vencimiento de pago, tienen saldo y no tienen recargo aplicado
      const overdueCycles = await this.subscription_cycle.findMany({
        where: {
          payment_due_date: { lte: thresholdDate },
          late_fee_applied: false,
          pending_balance: { gt: 0 },
          customer_subscription: {
            status: SubscriptionStatus.ACTIVE,
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

      this.logger.log(
        `📋 Encontrados ${overdueCycles.length} ciclos vencidos sin recargo aplicado`,
      );

      for (const cycle of overdueCycles) {
        try {
          // Determinar el precio base de la cuota (del plan) y calcular recargo del 20%
          const planPriceRaw =
            cycle.customer_subscription?.subscription_plan?.price as any;
          const currentTotalRaw = cycle.total_amount as any;
          const paidAmountRaw = cycle.paid_amount as any;

          const planPrice = parseFloat(planPriceRaw?.toString() || '0');
          const currentTotal = parseFloat(currentTotalRaw?.toString() || '0');
          const paidAmount = parseFloat(paidAmountRaw?.toString() || '0');

          // Si no tenemos total actual, usar el precio del plan como base
          const baseAmount = currentTotal > 0 ? currentTotal : planPrice;
          const lateFeePercentage = 0.2; // 20%
          const surcharge = Math.round(baseAmount * lateFeePercentage * 100) / 100;
          const newTotal = Math.round((baseAmount + surcharge) * 100) / 100;
          const newPending = Math.max(0, Math.round((newTotal - paidAmount) * 100) / 100);
          const newPaymentStatus = newPending > 0 ? 'OVERDUE' : 'PAID';

          // Marcar como vencido, aplicar recargo y actualizar montos
          await this.subscription_cycle.update({
            where: { cycle_id: cycle.cycle_id },
            data: {
              is_overdue: true,
              late_fee_applied: true,
              late_fee_percentage: lateFeePercentage,
              total_amount: newTotal,
              pending_balance: newPending,
              payment_status: newPaymentStatus,
            },
          });

          this.logger.log(
            `✅ Recargo del 20% aplicado al ciclo ${cycle.cycle_id} de la suscripción ${cycle.subscription_id}`,
          );
        } catch (error) {
          this.logger.error(
            `❌ Error aplicando recargo al ciclo ${cycle.cycle_id}:`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        '❌ Error en verificación de recargos por mora:',
        error,
      );
    }
  }

  /**
   * Método manual para forzar la renovación de ciclos (útil para testing)
   */
  async forceRenewalCheck() {
    this.logger.log('🔧 Ejecutando renovación manual de ciclos...');
    await this.renewExpiredCycles();
  }

  /**
   * Método manual para forzar la verificación de recargos (útil para testing)
   */
  async forceLateFeeCheck() {
    this.logger.log('🔧 Ejecutando verificación manual de recargos...');
    await this.checkAndApplyLateFees();
  }
}
