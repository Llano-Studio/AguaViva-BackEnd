import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient, OrderStatus as PrismaOrderStatus } from '@prisma/client';
import { OrderStatus } from '../../common/constants/enums';

@Injectable()
export class OverdueOrderService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(OverdueOrderService.name);

  constructor() {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Ejecuta la verificación de pedidos atrasados todos los días a las 7 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async markOverdueOrders() {
    this.logger.log('🔄 Iniciando verificación de pedidos atrasados...');

    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(23, 59, 59, 999); // Final del día hace 2 días

      // Buscar pedidos que fueron creados hace más de 2 días y no están en estado OVERDUE
      const overdueOrders = await this.order_header.findMany({
        where: {
          order_date: {
            lt: twoDaysAgo,
          },
          status: {
            notIn: [
              PrismaOrderStatus.OVERDUE,
              PrismaOrderStatus.DELIVERED,
              PrismaOrderStatus.CANCELLED,
              PrismaOrderStatus.REFUNDED,
            ],
          },
        },
        select: {
          order_id: true,
          order_date: true,
          status: true,
          customer: {
            select: {
              person_id: true,
              name: true,
            },
          },
        },
      });

      this.logger.log(
        `📊 Encontrados ${overdueOrders.length} pedidos atrasados`,
      );

      if (overdueOrders.length > 0) {
        // Actualizar el estado de los pedidos a OVERDUE
        const updateResult = await this.order_header.updateMany({
          where: {
            order_id: {
              in: overdueOrders.map((order) => order.order_id),
            },
          },
          data: {
            status: PrismaOrderStatus.OVERDUE,
          },
        });

        this.logger.log(
          `✅ Actualizados ${updateResult.count} pedidos a estado OVERDUE`,
        );

        // Log de los pedidos actualizados para auditoría
        overdueOrders.forEach((order) => {
          const daysDiff = Math.floor(
            (new Date().getTime() - order.order_date.getTime()) /
              (1000 * 60 * 60 * 24),
          );
          this.logger.log(
            `📋 Pedido ${order.order_id} - Cliente: ${(order as any).customer?.name || 'N/A'} - ` +
              `Creado hace ${daysDiff} días - Estado anterior: ${order.status}`,
          );
        });
      }
    } catch (error) {
      this.logger.error('❌ Error al marcar pedidos atrasados:', error);
      throw error;
    }
  }

  /**
   * Método manual para marcar pedidos atrasados (útil para testing o ejecución manual)
   */
  async markOverdueOrdersManually(): Promise<{ count: number; orders: any[] }> {
    this.logger.log('🔧 Ejecutando marcado manual de pedidos atrasados...');

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(23, 59, 59, 999);

    const overdueOrders = await this.order_header.findMany({
      where: {
        order_date: {
          lt: twoDaysAgo,
        },
        status: {
          notIn: [
            PrismaOrderStatus.OVERDUE,
            PrismaOrderStatus.DELIVERED,
            PrismaOrderStatus.CANCELLED,
            PrismaOrderStatus.REFUNDED,
          ],
        },
      },
      include: {
        customer: {
          select: {
            person_id: true,
            name: true,
          },
        },
      },
    });

    if (overdueOrders.length > 0) {
      const updateResult = await this.order_header.updateMany({
        where: {
          order_id: {
            in: overdueOrders.map((order) => order.order_id),
          },
        },
        data: {
          status: PrismaOrderStatus.OVERDUE,
        },
      });

      this.logger.log(
        `✅ Marcados ${updateResult.count} pedidos como atrasados manualmente`,
      );

      return {
        count: updateResult.count,
        orders: overdueOrders.map((order: any) => ({
          order_id: order.order_id,
          created_at: order.order_date,
          previous_status: order.status,
          customer: order.customer?.name || 'N/A',
          days_overdue: Math.floor(
            (new Date().getTime() - order.order_date.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        })),
      };
    }

    return { count: 0, orders: [] };
  }

  /**
   * Obtener estadísticas de pedidos atrasados
   */
  async getOverdueOrdersStats(): Promise<{
    total_overdue: number;
    by_days: { days_range: string; count: number }[];
    by_status_before_overdue: { previous_status: string; count: number }[];
  }> {
    const overdueOrders = await this.order_header.findMany({
      where: {
        status: PrismaOrderStatus.OVERDUE,
      },
      select: {
        order_id: true,
        order_date: true,
      },
    });

    const now = new Date();
    const byDays = {
      '2-7 días': 0,
      '8-15 días': 0,
      '16-30 días': 0,
      'Más de 30 días': 0,
    };

    overdueOrders.forEach((order) => {
      const daysDiff = Math.floor(
        (now.getTime() - order.order_date.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysDiff <= 7) {
        byDays['2-7 días']++;
      } else if (daysDiff <= 15) {
        byDays['8-15 días']++;
      } else if (daysDiff <= 30) {
        byDays['16-30 días']++;
      } else {
        byDays['Más de 30 días']++;
      }
    });

    return {
      total_overdue: overdueOrders.length,
      by_days: Object.entries(byDays).map(([days_range, count]) => ({
        days_range,
        count,
      })),
      by_status_before_overdue: [], // Se podría implementar un historial de cambios de estado
    };
  }
}