import { AccountMovementSide, Prisma } from '@prisma/client';
import {
  AccountMovement,
  AccountMovementConcept,
  buildStatement,
  dateOnlyMoment,
} from './account-statement';

function movement(
  key: string,
  iso: string,
  side: AccountMovementSide,
  amount: number,
  concept = side === AccountMovementSide.DEBIT
    ? AccountMovementConcept.ORDER
    : AccountMovementConcept.PAYMENT,
): AccountMovement {
  const at = new Date(iso);
  return {
    key,
    at,
    date: iso.slice(0, 10),
    side,
    concept,
    reference_id: null,
    description: key,
    amount: new Prisma.Decimal(amount),
    payment_method: null,
  };
}

const { DEBIT, CREDIT } = AccountMovementSide;

describe('buildStatement', () => {
  const movements = [
    movement('PAY-1', '2026-11-03T15:00:00Z', CREDIT, 400),
    movement('ORDER-1', '2026-11-01T12:00:00Z', DEBIT, 1000),
    movement('ORDER-2', '2026-11-05T12:00:00Z', DEBIT, 500),
    movement(
      'ADJ-1',
      '2026-11-06T12:00:00Z',
      CREDIT,
      100,
      AccountMovementConcept.ADJUSTMENT,
    ),
  ];

  it('ordena cronológicamente y acumula el saldo', () => {
    const result = buildStatement(movements, { page: 1, limit: 50 });

    expect(result.movements.map((m) => [m.key, m.balance.toFixed(2)])).toEqual([
      ['ORDER-1', '1000.00'],
      ['PAY-1', '600.00'],
      ['ORDER-2', '1100.00'],
      ['ADJ-1', '1000.00'],
    ]);
    expect(result.balance.toFixed(2)).toBe('1000.00');
    expect(result.totalDebits.toFixed(2)).toBe('1500.00');
    expect(result.totalCredits.toFixed(2)).toBe('500.00');
  });

  it('la fecha del último pago ignora ajustes', () => {
    expect(
      buildStatement(movements, { page: 1, limit: 50 }).lastPaymentDate,
    ).toBe('2026-11-03');
  });

  it('con período devuelve saldo de apertura y cierre', () => {
    const result = buildStatement(movements, {
      from: '2026-11-03',
      to: '2026-11-05',
      page: 1,
      limit: 50,
    });

    expect(result.openingBalance.toFixed(2)).toBe('1000.00');
    expect(result.movements.map((m) => m.key)).toEqual(['PAY-1', 'ORDER-2']);
    expect(result.closingBalance.toFixed(2)).toBe('1100.00');
    expect(result.balance.toFixed(2)).toBe('1000.00');
    expect(result.totalInPeriod).toBe(2);
  });

  it('pagina dentro del período', () => {
    const result = buildStatement(movements, { page: 2, limit: 3 });
    expect(result.movements.map((m) => m.key)).toEqual(['ADJ-1']);
    expect(result.totalInPeriod).toBe(4);
  });

  it('a igual instante pone el debe antes que el haber', () => {
    const sameTime = [
      movement('PAY-9', '2026-11-01T12:00:00Z', CREDIT, 100),
      movement('ORDER-9', '2026-11-01T12:00:00Z', DEBIT, 100),
    ];
    expect(
      buildStatement(sameTime, { page: 1, limit: 10 }).movements.map(
        (m) => m.key,
      ),
    ).toEqual(['ORDER-9', 'PAY-9']);
  });

  it('ubica las fechas sin hora a la medianoche de Buenos Aires', () => {
    const moment = dateOnlyMoment(new Date('2026-11-07T00:00:00.000Z'));
    expect(moment.date).toBe('2026-11-07');
    expect(moment.at.toISOString()).toBe('2026-11-07T03:00:00.000Z');
  });
});
