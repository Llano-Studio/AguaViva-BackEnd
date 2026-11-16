import { AccountMovementSide, Prisma } from '@prisma/client';
import { CustomerAccountSourcesService } from './customer-account-sources.service';
import { AccountMovementConcept } from './account-statement';

const { DEBIT, CREDIT } = AccountMovementSide;

describe('CustomerAccountSourcesService (AguaViva)', () => {
  let prisma: any;
  let service: CustomerAccountSourcesService;

  beforeEach(() => {
    prisma = {
      order_header: { findMany: jest.fn().mockResolvedValue([]) },
      payment_transaction: { findMany: jest.fn().mockResolvedValue([]) },
      subscription_cycle: { findMany: jest.fn().mockResolvedValue([]) },
      one_off_purchase: { findMany: jest.fn().mockResolvedValue([]) },
      one_off_purchase_header: { findMany: jest.fn().mockResolvedValue([]) },
      route_sheet_detail: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new CustomerAccountSourcesService(prisma);
  });

  const summary = (
    movements: { key: string; side: string; amount: Prisma.Decimal }[],
  ) => movements.map((m) => [m.key, m.side, m.amount.toFixed(2)]).sort();

  function order(
    id: number,
    total: number,
    paid: number,
    notes: string | null = null,
    items: number[] = [],
  ) {
    return {
      order_id: id,
      order_date: new Date('2026-11-05T12:00:00Z'),
      total_amount: new Prisma.Decimal(total),
      paid_amount: new Prisma.Decimal(paid),
      notes,
      subscription_id: notes ? 6 : null,
      order_item: items.map((subtotal) => ({
        subtotal: new Prisma.Decimal(subtotal),
      })),
    };
  }

  function payment(
    id: number,
    amount: number,
    orderId: number | null,
    document: string,
  ) {
    return {
      transaction_id: id,
      transaction_date: new Date('2026-11-06T12:00:00Z'),
      transaction_amount: new Prisma.Decimal(amount),
      order_id: orderId,
      document_number: document,
      payment_method: { description: 'Efectivo' },
    };
  }

  function cycle(
    id: number,
    start: string,
    total: number,
    payments: { id: number; amount: number; method: string }[] = [],
  ) {
    return {
      cycle_id: id,
      cycle_number: id,
      cycle_start: new Date(`${start}T00:00:00.000Z`),
      total_amount: new Prisma.Decimal(total),
      customer_subscription: { subscription_plan: { name: 'Abono 4' } },
      cycle_payments: payments.map((p) => ({
        payment_id: p.id,
        payment_date: new Date('2026-11-07T12:00:00Z'),
        amount: new Prisma.Decimal(p.amount),
        payment_method: p.method,
      })),
    };
  }

  it('la cuota es deuda del ciclo: el pedido de cobranza manual y su pago no se cuentan', async () => {
    prisma.order_header.findMany.mockResolvedValue([
      order(1, 8000, 8000, 'PEDIDO DE COBRANZA MANUAL - Ciclo: 3'),
    ]);
    prisma.payment_transaction.findMany.mockResolvedValue([
      payment(5, 8000, 1, 'RS-4-D9'),
    ]);
    prisma.subscription_cycle.findMany.mockResolvedValue([
      cycle(3, '2026-11-01', 8000, [
        { id: 70, amount: 8000, method: 'EFECTIVO' },
      ]),
    ]);

    expect(summary(await service.collect(10))).toEqual([
      ['CYCLE-3', DEBIT, '8000.00'],
      ['CYCLE-PAYMENT-70', CREDIT, '8000.00'],
    ]);
  });

  it('un pedido con productos y cobranza agregada solo debita los productos', async () => {
    prisma.order_header.findMany.mockResolvedValue([
      order(2, 10400, 0, 'Pedido | COBRANZA AGREGADA: Ciclo 3', [1200, 1200]),
    ]);

    expect(summary(await service.collect(10))).toEqual([
      ['ORDER-2', DEBIT, '2400.00'],
    ]);
  });

  it('ignora el cobro en ruta de una cuota porque ya está en cycle_payment', async () => {
    prisma.payment_transaction.findMany.mockResolvedValue([
      payment(5, 8000, null, 'RS-4-D9'),
      payment(6, 500, null, 'RS-4-D10'),
    ]);
    prisma.route_sheet_detail.findMany.mockResolvedValue([
      { route_sheet_detail_id: 9 },
    ]);

    const movements = await service.collect(10);

    expect(prisma.route_sheet_detail.findMany).toHaveBeenCalledWith({
      where: {
        route_sheet_detail_id: { in: [9, 10] },
        cycle_payment_id: { not: null },
      },
      select: { route_sheet_detail_id: true },
    });
    expect(summary(movements)).toEqual([['PAYMENT-6', CREDIT, '500.00']]);
  });

  it('separa el recargo por mora e ignora movimientos internos de saldo a favor', async () => {
    prisma.subscription_cycle.findMany.mockResolvedValue([
      cycle(3, '2026-11-01', 9600, [
        { id: 70, amount: -1600, method: 'RECARGO_MORA' },
        { id: 71, amount: 2000, method: 'TRANSFERENCIA_CREDITO' },
        { id: 72, amount: 500, method: 'APLICACION_CREDITO' },
        { id: 73, amount: 10000, method: 'TRANSFERENCIA' },
      ]),
    ]);

    const movements = await service.collect(10);

    expect(summary(movements)).toEqual([
      ['CYCLE-3', DEBIT, '8000.00'],
      ['CYCLE-PAYMENT-73', CREDIT, '10000.00'],
      ['LATE-FEE-70', DEBIT, '1600.00'],
    ]);
    expect(movements.find((m) => m.key === 'LATE-FEE-70')?.concept).toBe(
      AccountMovementConcept.LATE_FEE,
    );
  });

  it('un ciclo futuro no genera deuda todavía, pero sus pagos sí cuentan', async () => {
    prisma.subscription_cycle.findMany.mockResolvedValue([
      cycle(4, '2999-01-01', 8000, [
        { id: 80, amount: 8000, method: 'EFECTIVO' },
      ]),
    ]);

    expect(summary(await service.collect(10))).toEqual([
      ['CYCLE-PAYMENT-80', CREDIT, '8000.00'],
    ]);
  });

  it('suma las compras puntuales y los pagos de pedidos comunes', async () => {
    prisma.order_header.findMany.mockResolvedValue([order(7, 3000, 3000)]);
    prisma.payment_transaction.findMany.mockResolvedValue([
      payment(9, 1000, 7, 'ORD-7'),
      payment(10, 700, null, 'ONE-OFF-4'),
    ]);
    prisma.one_off_purchase_header.findMany.mockResolvedValue([
      {
        purchase_header_id: 4,
        purchase_date: new Date('2026-11-02T12:00:00Z'),
        total_amount: new Prisma.Decimal(700),
      },
    ]);

    expect(summary(await service.collect(10))).toEqual([
      ['ONE-OFF-H-4', DEBIT, '700.00'],
      ['ORDER-7', DEBIT, '3000.00'],
      ['ORDER-PAID-7', CREDIT, '2000.00'],
      ['PAYMENT-10', CREDIT, '700.00'],
      ['PAYMENT-9', CREDIT, '1000.00'],
    ]);
  });
});
