import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient, SubscriptionStatus } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class SubscriptionCycleRenewalService
  extends PrismaClient
  implements OnModuleInit
{
  private readonly logger = new Logger(SubscriptionCycleRenewalService.name);

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
   * Crea un nuevo ciclo para una suscripción específica
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

      // Crear el nuevo ciclo
      const newCycle = await this.subscription_cycle.create({
        data: {
          subscription_id: subscription.subscription_id,
          cycle_start: cycleStartDate,
          cycle_end: cycleEndDate,
          payment_due_date: paymentDueDate,
          is_overdue: false,
          late_fee_applied: false,
          late_fee_percentage: new Decimal(20.0), // 20% de recargo
          notes: 'Ciclo renovado automáticamente',
        },
      });

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

    try {
      // Buscar ciclos que han pasado la fecha de vencimiento de pago y no tienen recargo aplicado
      const overdueCycles = await this.subscription_cycle.findMany({
        where: {
          payment_due_date: {
            lt: today,
          },
          late_fee_applied: false,
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
          // Marcar como vencido y aplicar recargo
          await this.subscription_cycle.update({
            where: { cycle_id: cycle.cycle_id },
            data: {
              is_overdue: true,
              late_fee_applied: true,
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
