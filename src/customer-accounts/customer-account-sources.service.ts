import { Injectable } from '@nestjs/common';
import { AccountMovementSide, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod } from '../common/constants/enums';
import {
  AccountMovement,
  AccountMovementConcept,
  dateOnlyMoment,
  instantMoment,
} from './account-statement';

/** Pedidos que no generan deuda. */
const NON_BILLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
];

/** Movimientos internos de cycle_payment que no son plata nueva del cliente. */
const INTERNAL_CYCLE_METHODS = new Set<string>([
  PaymentMethod.RECARGO_MORA,
  PaymentMethod.TRANSFERENCIA_CREDITO,
  PaymentMethod.APLICACION_CREDITO,
]);

/** Diferencias menores a medio centavo se consideran redondeo. */
const EPSILON = new Prisma.Decimal('0.005');

/** Número de documento de los cobros en ruta: RS-<hoja>-D<parada>. */
const ROUTE_DOCUMENT = /^RS-\d+-D(\d+)$/;

const ZERO = new Prisma.Decimal(0);

/**
 * Movimientos de AguaViva que salen de los datos operativos. La cuota del
 * abono es deuda del ciclo; los pedidos de cobranza solo la cobran, así que:
 * - Debe: cada ciclo de abono ya iniciado, por su total sin recargo, a la
 *   fecha de inicio; el recargo por mora, a la fecha en que se aplicó.
 * - Debe: cada pedido activo y no cancelado, por su total. Si el pedido lleva
 *   una cobranza (notas con "COBRANZA"), solo cuenta la parte de productos.
 * - Debe: cada compra puntual activa y no cancelada.
 * - Haber: los pagos de ciclo (cycle_payment) reales; se ignoran recargos,
 *   traspasos y aplicaciones de saldo a favor entre ciclos, que no son plata
 *   nueva. El saldo a favor de un ciclo queda reflejado como pago de más.
 * - Haber: los pagos (payment_transaction), salvo los que el sistema ya
 *   volcó a cycle_payment (cobranza manual y cobros en ruta de cuotas), para
 *   no contarlos dos veces.
 * - Haber: lo que el pedido figura como pagado sin un pago que lo respalde.
 */
@Injectable()
export class CustomerAccountSourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async collect(customerId: number): Promise<AccountMovement[]> {
    const [orders, payments, cycles, oneOffs, oneOffHeaders] =
      await Promise.all([
        this.prisma.order_header.findMany({
          where: {
            customer_id: customerId,
            is_active: true,
            status: { notIn: NON_BILLABLE_STATUSES },
          },
          select: {
            order_id: true,
            order_date: true,
            total_amount: true,
            paid_amount: true,
            notes: true,
            subscription_id: true,
            order_item: { select: { subtotal: true } },
          },
        }),
        this.prisma.payment_transaction.findMany({
          where: {
            customer_id: customerId,
            is_active: true,
            transaction_type: 'PAYMENT',
          },
          select: {
            transaction_id: true,
            transaction_date: true,
            transaction_amount: true,
            order_id: true,
            document_number: true,
            payment_method: { select: { description: true } },
          },
        }),
        this.prisma.subscription_cycle.findMany({
          where: { customer_subscription: { customer_id: customerId } },
          select: {
            cycle_id: true,
            cycle_number: true,
            cycle_start: true,
            total_amount: true,
            customer_subscription: {
              select: { subscription_plan: { select: { name: true } } },
            },
            cycle_payments: {
              select: {
                payment_id: true,
                payment_date: true,
                amount: true,
                payment_method: true,
              },
            },
          },
        }),
        this.prisma.one_off_purchase.findMany({
          where: {
            person_id: customerId,
            is_active: true,
            status: { not: 'CANCELLED' },
          },
          select: {
            purchase_id: true,
            purchase_date: true,
            total_amount: true,
          },
        }),
        this.prisma.one_off_purchase_header.findMany({
          where: {
            person_id: customerId,
            is_active: true,
            status: { not: 'CANCELLED' },
          },
          select: {
            purchase_header_id: true,
            purchase_date: true,
            total_amount: true,
          },
        }),
      ]);

    const movements: AccountMovement[] = [];
    const ordersMirroredToCycles = new Set<number>();

    // Pedidos
    const billableOrders: typeof orders = [];
    for (const order of orders) {
      const notes = order.notes ?? '';
      const carriesCollection = /COBRANZA/i.test(notes);
      if (/COBRANZA MANUAL/i.test(notes) && order.subscription_id) {
        ordersMirroredToCycles.add(order.order_id);
      }
      const amount = carriesCollection
        ? order.order_item.reduce(
            (sum, item) => sum.plus(item.subtotal),
            new Prisma.Decimal(0),
          )
        : new Prisma.Decimal(order.total_amount);
      if (!ordersMirroredToCycles.has(order.order_id)) {
        billableOrders.push(order);
      }
      if (amount.lte(0)) continue;
      movements.push({
        key: `ORDER-${order.order_id}`,
        ...instantMoment(order.order_date),
        side: AccountMovementSide.DEBIT,
        concept: AccountMovementConcept.ORDER,
        reference_id: order.order_id,
        description: carriesCollection
          ? `Pedido #${order.order_id} (productos)`
          : `Pedido #${order.order_id}`,
        amount,
        payment_method: null,
      });
    }

    // Pagos (payment_transaction), salvo los volcados a cycle_payment
    const routeDetailIds = payments
      .filter((p) => !p.order_id)
      .map((p) => ROUTE_DOCUMENT.exec(p.document_number)?.[1])
      .filter((id): id is string => Boolean(id))
      .map(Number);
    const cycleStops = new Set(
      routeDetailIds.length
        ? (
            await this.prisma.route_sheet_detail.findMany({
              where: {
                route_sheet_detail_id: { in: routeDetailIds },
                cycle_payment_id: { not: null },
              },
              select: { route_sheet_detail_id: true },
            })
          ).map((d) => d.route_sheet_detail_id)
        : [],
    );

    const paidByOrder = new Map<number, Prisma.Decimal>();
    for (const payment of payments) {
      const amount = new Prisma.Decimal(payment.transaction_amount);
      if (amount.lte(0)) continue;
      if (payment.order_id && ordersMirroredToCycles.has(payment.order_id)) {
        continue;
      }
      const routeDetailId = ROUTE_DOCUMENT.exec(payment.document_number)?.[1];
      if (
        !payment.order_id &&
        routeDetailId &&
        cycleStops.has(Number(routeDetailId))
      ) {
        continue;
      }
      if (payment.order_id) {
        paidByOrder.set(
          payment.order_id,
          (paidByOrder.get(payment.order_id) ?? ZERO).plus(amount),
        );
      }
      movements.push({
        key: `PAYMENT-${payment.transaction_id}`,
        ...instantMoment(payment.transaction_date),
        side: AccountMovementSide.CREDIT,
        concept: AccountMovementConcept.PAYMENT,
        reference_id: payment.transaction_id,
        description: payment.order_id
          ? `Pago del pedido #${payment.order_id}`
          : `Pago ${payment.document_number}`,
        amount,
        payment_method: payment.payment_method?.description ?? null,
      });
    }

    for (const order of billableOrders) {
      const unbacked = new Prisma.Decimal(order.paid_amount).minus(
        paidByOrder.get(order.order_id) ?? ZERO,
      );
      if (unbacked.gt(EPSILON)) {
        movements.push({
          key: `ORDER-PAID-${order.order_id}`,
          ...instantMoment(order.order_date),
          side: AccountMovementSide.CREDIT,
          concept: AccountMovementConcept.ORDER_RECORDED_PAYMENT,
          reference_id: order.order_id,
          description: `Pago registrado en el pedido #${order.order_id}`,
          amount: unbacked,
          payment_method: null,
        });
      }
    }

    // Ciclos de abono
    const today = new Date();
    for (const cycle of cycles) {
      const plan = cycle.customer_subscription.subscription_plan.name;
      let lateFees = ZERO;
      for (const payment of cycle.cycle_payments) {
        const amount = new Prisma.Decimal(payment.amount);
        if (payment.payment_method === String(PaymentMethod.RECARGO_MORA)) {
          const fee = amount.abs();
          lateFees = lateFees.plus(fee);
          movements.push({
            key: `LATE-FEE-${payment.payment_id}`,
            ...instantMoment(payment.payment_date),
            side: AccountMovementSide.DEBIT,
            concept: AccountMovementConcept.LATE_FEE,
            reference_id: cycle.cycle_id,
            description: `Recargo por mora - ${plan} ciclo ${cycle.cycle_number}`,
            amount: fee,
            payment_method: null,
          });
          continue;
        }
        if (
          INTERNAL_CYCLE_METHODS.has(payment.payment_method) ||
          amount.lte(0)
        ) {
          continue;
        }
        movements.push({
          key: `CYCLE-PAYMENT-${payment.payment_id}`,
          ...instantMoment(payment.payment_date),
          side: AccountMovementSide.CREDIT,
          concept: AccountMovementConcept.CYCLE_PAYMENT,
          reference_id: payment.payment_id,
          description: `Pago abono ${plan} ciclo ${cycle.cycle_number}`,
          amount,
          payment_method: payment.payment_method,
        });
      }

      if (cycle.cycle_start > today) continue;
      const base = new Prisma.Decimal(cycle.total_amount ?? 0).minus(lateFees);
      if (base.lte(0)) continue;
      movements.push({
        key: `CYCLE-${cycle.cycle_id}`,
        ...dateOnlyMoment(cycle.cycle_start),
        side: AccountMovementSide.DEBIT,
        concept: AccountMovementConcept.SUBSCRIPTION_CYCLE,
        reference_id: cycle.cycle_id,
        description: `Abono ${plan} - ciclo ${cycle.cycle_number}`,
        amount: base,
        payment_method: null,
      });
    }

    // Compras puntuales
    for (const purchase of oneOffs) {
      this.pushOneOff(
        movements,
        `ONE-OFF-${purchase.purchase_id}`,
        purchase.purchase_id,
        purchase.purchase_date,
        purchase.total_amount,
      );
    }
    for (const purchase of oneOffHeaders) {
      this.pushOneOff(
        movements,
        `ONE-OFF-H-${purchase.purchase_header_id}`,
        purchase.purchase_header_id,
        purchase.purchase_date,
        purchase.total_amount,
      );
    }

    return movements;
  }

  private pushOneOff(
    movements: AccountMovement[],
    key: string,
    referenceId: number,
    date: Date,
    total: Prisma.Decimal,
  ) {
    const amount = new Prisma.Decimal(total);
    if (amount.lte(0)) return;
    movements.push({
      key,
      ...instantMoment(date),
      side: AccountMovementSide.DEBIT,
      concept: AccountMovementConcept.ONE_OFF,
      reference_id: referenceId,
      description: `Compra puntual #${referenceId}`,
      amount,
      payment_method: null,
    });
  }
}
