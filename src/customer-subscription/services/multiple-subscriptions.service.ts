import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaClient, SubscriptionStatus } from '@prisma/client';
import { CustomerSubscriptionResponseDto } from '../dto/customer-subscription-response.dto';

export interface MultipleSubscriptionSummaryDto {
  customer_id: number;
  customer_name: string;
  active_subscriptions: CustomerSubscriptionResponseDto[];
  total_active_cycles: number;
  total_pending_amount: number;
  total_credit_balance: number;
  payment_summary: {
    total_paid: number;
    total_pending: number;
    total_overdue: number;
  };
}

export interface ActiveCycleSummaryDto {
  cycle_id: number;
  subscription_id: number;
  subscription_plan_name: string;
  cycle_start: string;
  cycle_end: string;
  payment_due_date: string;
  total_amount: number;
  paid_amount: number;
  pending_balance: number;
  credit_balance: number;
  payment_status: string;
  is_overdue: boolean;
}

@Injectable()
export class MultipleSubscriptionsService
  extends PrismaClient
  implements OnModuleInit
{
  constructor() {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Obtiene el resumen completo de todas las suscripciones activas de un cliente
   */
  async getCustomerSubscriptionsSummary(
    customerId: number,
  ): Promise<MultipleSubscriptionSummaryDto> {
    // Verificar que el cliente existe
    const customer = await this.person.findUnique({
      where: { person_id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Cliente con ID ${customerId} no encontrado`);
    }

    // Obtener todas las suscripciones activas del cliente
    const activeSubscriptions = await this.customer_subscription.findMany({
      where: {
        customer_id: customerId,
        status: SubscriptionStatus.ACTIVE,
      },
      include: {
        subscription_plan: {
          include: {
            subscription_plan_product: {
              include: { product: true },
            },
          },
        },
        subscription_cycle: {
          where: {
            cycle_end: { gte: new Date() }, // Solo ciclos activos o futuros
          },
          orderBy: { cycle_start: 'desc' },
          take: 1, // Solo el ciclo más reciente
        },
        _count: {
          select: { order_header: true },
        },
      },
    });

    // Calcular totales
    let totalPendingAmount = 0;
    let totalCreditBalance = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalOverdue = 0;
    let totalActiveCycles = 0;

    const today = new Date();

    for (const subscription of activeSubscriptions) {
      for (const cycle of subscription.subscription_cycle) {
        totalActiveCycles++;
        totalPendingAmount += Number(cycle.pending_balance);
        totalCreditBalance += Number(cycle.credit_balance);
        totalPaid += Number(cycle.paid_amount);

        if (
          cycle.payment_status === 'PENDING' ||
          cycle.payment_status === 'PARTIAL'
        ) {
          if (
            cycle.payment_due_date &&
            new Date(cycle.payment_due_date) < today
          ) {
            totalOverdue += Number(cycle.pending_balance);
          } else {
            totalPending += Number(cycle.pending_balance);
          }
        }
      }
    }

    // Mapear suscripciones a DTOs
    const subscriptionDtos: CustomerSubscriptionResponseDto[] =
      activeSubscriptions.map((subscription) => ({
        subscription_id: subscription.subscription_id,
        customer_id: subscription.customer_id,
        customer_name: `${customer.name}`,
        subscription_plan_id: subscription.subscription_plan_id,
        start_date: subscription.start_date.toISOString().split('T')[0],
        // end_date field removed - not present in schema
        collection_date:
          subscription.collection_date?.toISOString().split('T')[0] || null,
        status: subscription.status,
        notes: subscription.notes,
        cancellation_reason: subscription.cancellation_reason,
        cancellation_date:
          subscription.cancellation_date?.toISOString().split('T')[0] || null,
        collection_scheduled_date:
          subscription.collection_scheduled_date?.toISOString().split('T')[0] ||
          null,
        collection_completed: subscription.collection_completed,
        is_active: subscription.is_active,
        subscription_plan: {
          subscription_plan_id:
            subscription.subscription_plan.subscription_plan_id,
          name: subscription.subscription_plan.name,
          description: subscription.subscription_plan.description,
          price: parseFloat(
            subscription.subscription_plan.price?.toString() || '0',
          ),
        },
        subscription_cycle: subscription.subscription_cycle?.map(
          (cycle: any) => ({
            cycle_id: cycle.cycle_id,
            cycle_start: cycle.cycle_start.toISOString().split('T')[0],
            cycle_end: cycle.cycle_end.toISOString().split('T')[0],
            notes: cycle.notes,
          }),
        ),
        orders_count: subscription._count?.order_header || 0,
      }));

    return {
      customer_id: customerId,
      customer_name: `${customer.name}`,
      active_subscriptions: subscriptionDtos,
      total_active_cycles: totalActiveCycles,
      total_pending_amount: totalPendingAmount,
      total_credit_balance: totalCreditBalance,
      payment_summary: {
        total_paid: totalPaid,
        total_pending: totalPending,
        total_overdue: totalOverdue,
      },
    };
  }

  /**
   * Obtiene todos los ciclos activos de un cliente con información detallada
   */
  async getCustomerActiveCycles(
    customerId: number,
  ): Promise<ActiveCycleSummaryDto[]> {
    const today = new Date();

    const activeCycles = await this.subscription_cycle.findMany({
      where: {
        customer_subscription: {
          customer_id: customerId,
          status: SubscriptionStatus.ACTIVE,
        },
        cycle_end: { gte: today }, // Solo ciclos que no han terminado
      },
      include: {
        customer_subscription: {
          include: {
            subscription_plan: true,
          },
        },
      },
      orderBy: [
        { cycle_start: 'asc' },
        { customer_subscription: { subscription_plan: { name: 'asc' } } },
      ],
    });

    return activeCycles.map((cycle) => {
      const isOverdue =
        cycle.payment_due_date && new Date(cycle.payment_due_date) < today;

      return {
        cycle_id: cycle.cycle_id,
        subscription_id: cycle.subscription_id,
        subscription_plan_name:
          cycle.customer_subscription.subscription_plan.name,
        cycle_start: cycle.cycle_start.toISOString().split('T')[0],
        cycle_end: cycle.cycle_end.toISOString().split('T')[0],
        payment_due_date:
          cycle.payment_due_date?.toISOString().split('T')[0] || '',
        total_amount: Number(cycle.total_amount || 0),
        paid_amount: Number(cycle.paid_amount),
        pending_balance: Number(cycle.pending_balance),
        credit_balance: Number(cycle.credit_balance),
        payment_status: cycle.payment_status,
        is_overdue: !!isOverdue,
      };
    });
  }

  /**
   * Obtiene estadísticas consolidadas de múltiples suscripciones
   */
  async getMultipleSubscriptionsStats(): Promise<{
    total_customers_with_multiple_subscriptions: number;
    total_active_subscriptions: number;
    total_active_cycles: number;
    average_subscriptions_per_customer: number;
    payment_status_distribution: {
      pending: number;
      partial: number;
      paid: number;
      overdue: number;
      credited: number;
    };
  }> {
    // Contar clientes con múltiples suscripciones activas
    const customersWithMultipleSubscriptions =
      await this.customer_subscription.groupBy({
        by: ['customer_id'],
        where: {
          status: SubscriptionStatus.ACTIVE,
        },
        _count: {
          subscription_id: true,
        },
        having: {
          subscription_id: {
            _count: {
              gt: 1,
            },
          },
        },
      });

    // Contar total de suscripciones activas
    const totalActiveSubscriptions = await this.customer_subscription.count({
      where: {
        status: SubscriptionStatus.ACTIVE,
      },
    });

    // Contar total de ciclos activos
    const today = new Date();
    const totalActiveCycles = await this.subscription_cycle.count({
      where: {
        customer_subscription: {
          status: SubscriptionStatus.ACTIVE,
        },
        cycle_end: { gte: today },
      },
    });

    // Distribución de estados de pago
    const paymentStatusDistribution = await this.subscription_cycle.groupBy({
      by: ['payment_status'],
      where: {
        customer_subscription: {
          status: SubscriptionStatus.ACTIVE,
        },
        cycle_end: { gte: today },
      },
      _count: {
        cycle_id: true,
      },
    });

    const statusCounts = {
      pending: 0,
      partial: 0,
      paid: 0,
      overdue: 0,
      credited: 0,
    };

    paymentStatusDistribution.forEach((status) => {
      const statusKey =
        status.payment_status.toLowerCase() as keyof typeof statusCounts;
      if (statusKey in statusCounts) {
        statusCounts[statusKey] = status._count.cycle_id;
      }
    });

    const totalCustomersWithSubscriptions =
      await this.customer_subscription.groupBy({
        by: ['customer_id'],
        where: {
          status: SubscriptionStatus.ACTIVE,
        },
      });

    const averageSubscriptionsPerCustomer =
      totalCustomersWithSubscriptions.length > 0
        ? totalActiveSubscriptions / totalCustomersWithSubscriptions.length
        : 0;

    return {
      total_customers_with_multiple_subscriptions:
        customersWithMultipleSubscriptions.length,
      total_active_subscriptions: totalActiveSubscriptions,
      total_active_cycles: totalActiveCycles,
      average_subscriptions_per_customer:
        Math.round(averageSubscriptionsPerCustomer * 100) / 100,
      payment_status_distribution: statusCounts,
    };
  }

  /**
   * Obtiene todos los clientes que tienen múltiples suscripciones activas
   */
  async getCustomersWithMultipleSubscriptions(): Promise<
    {
      customer_id: number;
      customer_name: string;
      subscription_count: number;
      total_pending_amount: number;
      total_credit_balance: number;
    }[]
  > {
    // Obtener clientes con múltiples suscripciones activas
    const customersWithMultipleSubscriptions =
      await this.customer_subscription.groupBy({
        by: ['customer_id'],
        where: {
          status: SubscriptionStatus.ACTIVE,
        },
        _count: {
          subscription_id: true,
        },
        having: {
          subscription_id: {
            _count: {
              gt: 1,
            },
          },
        },
      });

    // Para cada cliente, obtener información detallada
    const result = [];

    for (const customerGroup of customersWithMultipleSubscriptions) {
      const customerId = customerGroup.customer_id;
      const subscriptionCount = customerGroup._count.subscription_id;

      // Obtener información del cliente
      const customer = await this.person.findUnique({
        where: { person_id: customerId },
        select: { name: true },
      });

      if (!customer) continue;

      // Obtener totales de pending_balance y credit_balance de todos los ciclos activos
      const today = new Date();
      const activeCycles = await this.subscription_cycle.findMany({
        where: {
          customer_subscription: {
            customer_id: customerId,
            status: SubscriptionStatus.ACTIVE,
          },
          cycle_end: { gte: today },
        },
        select: {
          pending_balance: true,
          credit_balance: true,
        },
      });

      const totalPendingAmount = activeCycles.reduce(
        (sum, cycle) => sum + Number(cycle.pending_balance || 0),
        0,
      );

      const totalCreditBalance = activeCycles.reduce(
        (sum, cycle) => sum + Number(cycle.credit_balance || 0),
        0,
      );

      result.push({
        customer_id: customerId,
        customer_name: customer.name,
        subscription_count: subscriptionCount,
        total_pending_amount: totalPendingAmount,
        total_credit_balance: totalCreditBalance,
      });
    }

    // Ordenar por cantidad de suscripciones descendente
    return result.sort((a, b) => b.subscription_count - a.subscription_count);
  }

  /**
   * Consolida pagos de múltiples ciclos para un cliente
   */
  async consolidateCustomerPayments(customerId: number): Promise<{
    total_amount_due: number;
    total_credit_available: number;
    net_amount_due: number;
    cycles_with_debt: ActiveCycleSummaryDto[];
    cycles_with_credit: ActiveCycleSummaryDto[];
  }> {
    const activeCycles = await this.getCustomerActiveCycles(customerId);

    const cyclesWithDebt = activeCycles.filter(
      (cycle) => cycle.pending_balance > 0,
    );
    const cyclesWithCredit = activeCycles.filter(
      (cycle) => cycle.credit_balance > 0,
    );

    const totalAmountDue = cyclesWithDebt.reduce(
      (sum, cycle) => sum + cycle.pending_balance,
      0,
    );
    const totalCreditAvailable = cyclesWithCredit.reduce(
      (sum, cycle) => sum + cycle.credit_balance,
      0,
    );
    const netAmountDue = Math.max(0, totalAmountDue - totalCreditAvailable);

    return {
      total_amount_due: totalAmountDue,
      total_credit_available: totalCreditAvailable,
      net_amount_due: netAmountDue,
      cycles_with_debt: cyclesWithDebt,
      cycles_with_credit: cyclesWithCredit,
    };
  }
}
