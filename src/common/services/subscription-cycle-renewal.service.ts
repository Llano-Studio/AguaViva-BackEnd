import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient, SubscriptionStatus } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SubscriptionCycleRenewalService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionCycleRenewalService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('SubscriptionCycleRenewalService initialized');
  }

  /**
   * Tarea programada que se ejecuta diariamente a las 00:01
   * para verificar y crear nuevos ciclos de suscripción cuando sea necesario
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async renewExpiredCycles() {
    this.logger.log('🔄 Iniciando renovación automática de ciclos de suscripción...');
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Buscar suscripciones activas cuyos ciclos actuales han expirado
      const expiredCycles = await this.subscription_cycle.findMany({
        where: {
          cycle_end: {
            lt: today // Ciclos que terminaron antes de hoy
          },
          customer_subscription: {
            status: SubscriptionStatus.ACTIVE
          }
        },
        include: {
          customer_subscription: {
            include: {
              subscription_plan: {
                include: {
                  subscription_plan_product: true
                }
              }
            }
          }
        }
      });

      this.logger.log(`📊 Encontrados ${expiredCycles.length} ciclos expirados para renovar`);

      for (const expiredCycle of expiredCycles) {
        await this.createNewCycleForSubscription(expiredCycle.customer_subscription);
      }

      this.logger.log('✅ Renovación automática de ciclos completada');
    } catch (error) {
      this.logger.error('❌ Error durante la renovación automática de ciclos:', error);
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

      // Crear el nuevo ciclo
      const newCycle = await this.subscription_cycle.create({
        data: {
          subscription_id: subscription.subscription_id,
          cycle_start: cycleStartDate,
          cycle_end: cycleEndDate,
          notes: 'Ciclo renovado automáticamente'
        }
      });

      // Crear los detalles del ciclo basados en el plan de suscripción
      for (const planProduct of subscription.subscription_plan.subscription_plan_product) {
        await this.subscription_cycle_detail.create({
          data: {
            cycle_id: newCycle.cycle_id,
            product_id: planProduct.product_id,
            planned_quantity: planProduct.product_quantity,
            delivered_quantity: 0,
            remaining_balance: planProduct.product_quantity
          }
        });
      }

      this.logger.log(
        `✅ Nuevo ciclo creado para suscripción ${subscription.subscription_id}: ` +
        `${cycleStartDate.toISOString().split('T')[0]} - ${cycleEndDate.toISOString().split('T')[0]}`
      );

    } catch (error) {
      this.logger.error(
        `❌ Error creando nuevo ciclo para suscripción ${subscription.subscription_id}:`,
        error
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
}