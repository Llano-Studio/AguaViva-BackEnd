import { Prisma } from '@prisma/client';
import {
  allocatePayment,
  dueDateFor,
  interestFor,
  isOverdue,
  outstandingOf,
  readDriverCreditPolicy,
} from './driver-credit.rules';

const d = (value: string | number) => new Prisma.Decimal(value);

describe('driver credit rules', () => {
  it('vence el día 10 del mes siguiente al cargo', () => {
    expect(dueDateFor('2026-11-16', 10)).toBe('2026-12-10');
    expect(dueDateFor('2026-11-01', 10)).toBe('2026-12-10');
    expect(dueDateFor('2026-12-28', 10)).toBe('2027-01-10');
  });

  it('el interés corre recién después del vencimiento', () => {
    expect(isOverdue('2026-12-10', '2026-12-10')).toBe(false);
    expect(isOverdue('2026-12-10', '2026-12-11')).toBe(true);
  });

  it('el interés es el 20% de lo impago del cargo, no del total', () => {
    expect(interestFor(d(100000), d('0.20')).toFixed(2)).toBe('20000.00');
    expect(interestFor(d('333.33'), d('0.20')).toFixed(2)).toBe('66.67');
    expect(interestFor(d(0), d('0.20')).toFixed(2)).toBe('0.00');
  });

  it('el saldo de un cargo suma el interés y resta lo pagado', () => {
    expect(
      outstandingOf({
        charge_id: 1,
        amount: d(100000),
        settled_amount: d(30000),
        interest_amount: d(14000),
      }).toFixed(2),
    ).toBe('84000.00');
  });

  it('imputa los pagos en orden y no pasa del saldo de cada cargo', () => {
    const allocations = allocatePayment(
      [
        {
          charge_id: 1,
          amount: d(1000),
          settled_amount: d(1000),
          interest_amount: null,
        },
        {
          charge_id: 2,
          amount: d(500),
          settled_amount: d(0),
          interest_amount: d(100),
        },
        {
          charge_id: 3,
          amount: d(800),
          settled_amount: d(0),
          interest_amount: null,
        },
      ],
      d(900),
    );
    expect(allocations.map((a) => [a.charge_id, a.amount.toFixed(2)])).toEqual([
      [2, '600.00'],
      [3, '300.00'],
    ]);
  });

  it('toma la tasa y el día del entorno y valida los valores', () => {
    const policy = readDriverCreditPolicy({});
    expect(policy.rate.toFixed(2)).toBe('0.20');
    expect(policy.dueDay).toBe(10);
    expect(
      readDriverCreditPolicy({
        DRIVER_CREDIT_INTEREST_RATE: '0.15',
        DRIVER_CREDIT_DUE_DAY: '5',
      }),
    ).toEqual({ rate: d('0.15'), dueDay: 5 });
    expect(() =>
      readDriverCreditPolicy({ DRIVER_CREDIT_DUE_DAY: '31' }),
    ).toThrow();
  });
});
