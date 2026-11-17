import { AccountMovementSide, Prisma } from '@prisma/client';
import { formatBAYMD, parseBAYMD } from '../common/utils/date.utils';

/** Origen de cada movimiento de la cuenta corriente. */
export enum AccountMovementConcept {
  ORDER = 'ORDER',
  ONE_OFF = 'ONE_OFF',
  SUBSCRIPTION_CYCLE = 'SUBSCRIPTION_CYCLE',
  LATE_FEE = 'LATE_FEE',
  PAYMENT = 'PAYMENT',
  ORDER_RECORDED_PAYMENT = 'ORDER_RECORDED_PAYMENT',
  CYCLE_PAYMENT = 'CYCLE_PAYMENT',
  OPENING_BALANCE = 'OPENING_BALANCE',
  ADJUSTMENT = 'ADJUSTMENT',
}

export interface AccountMovement {
  /** Identificador estable del movimiento (ej. "ORDER-12", "PAYMENT-55"). */
  key: string;
  /** Fecha contable (YYYY-MM-DD, Buenos Aires). */
  date: string;
  /** Instante usado para ordenar. */
  at: Date;
  side: AccountMovementSide;
  concept: AccountMovementConcept;
  reference_id: number | null;
  description: string;
  amount: Prisma.Decimal;
  payment_method: string | null;
}

export interface StatementOptions {
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

export interface StatementMovement extends Omit<AccountMovement, 'at'> {
  balance: Prisma.Decimal;
}

export interface Statement {
  totalDebits: Prisma.Decimal;
  totalCredits: Prisma.Decimal;
  balance: Prisma.Decimal;
  lastPaymentDate: string | null;
  openingBalance: Prisma.Decimal;
  closingBalance: Prisma.Decimal;
  totalInPeriod: number;
  movements: StatementMovement[];
}

const ZERO = new Prisma.Decimal(0);

const PAYMENT_CONCEPTS: ReadonlySet<AccountMovementConcept> = new Set([
  AccountMovementConcept.PAYMENT,
  AccountMovementConcept.ORDER_RECORDED_PAYMENT,
  AccountMovementConcept.CYCLE_PAYMENT,
]);

/** Movimiento con fecha de un campo de solo fecha: lo ubica a la medianoche de Buenos Aires. */
export function dateOnlyMoment(value: Date): { date: string; at: Date } {
  const date = formatBAYMD(value);
  return { date, at: parseBAYMD(date) };
}

export function instantMoment(value: Date): { date: string; at: Date } {
  return { date: formatBAYMD(value), at: value };
}

/**
 * Ordena los movimientos, calcula el saldo acumulado (positivo = el cliente
 * debe, negativo = saldo a favor) y recorta el período y la página pedidos.
 * El saldo de apertura del período es el acumulado de todo lo anterior.
 */
export function buildStatement(
  movements: AccountMovement[],
  options: StatementOptions,
): Statement {
  const sorted = [...movements].sort(
    (a, b) =>
      a.at.getTime() - b.at.getTime() ||
      (a.side === b.side ? 0 : a.side === AccountMovementSide.DEBIT ? -1 : 1) ||
      a.key.localeCompare(b.key),
  );

  let balance = ZERO;
  let totalDebits = ZERO;
  let totalCredits = ZERO;
  let lastPaymentDate: string | null = null;
  let openingBalance = ZERO;
  let closingBalance = ZERO;
  const inPeriod: StatementMovement[] = [];

  for (const movement of sorted) {
    if (movement.side === AccountMovementSide.DEBIT) {
      balance = balance.plus(movement.amount);
      totalDebits = totalDebits.plus(movement.amount);
    } else {
      balance = balance.minus(movement.amount);
      totalCredits = totalCredits.plus(movement.amount);
      if (PAYMENT_CONCEPTS.has(movement.concept)) {
        lastPaymentDate = movement.date;
      }
    }

    if (options.from && movement.date < options.from) {
      openingBalance = balance;
      closingBalance = balance;
      continue;
    }
    if (options.to && movement.date > options.to) continue;

    inPeriod.push({
      key: movement.key,
      date: movement.date,
      side: movement.side,
      concept: movement.concept,
      reference_id: movement.reference_id,
      description: movement.description,
      amount: movement.amount,
      payment_method: movement.payment_method,
      balance,
    });
    closingBalance = balance;
  }

  const start = (options.page - 1) * options.limit;
  return {
    totalDebits,
    totalCredits,
    balance,
    lastPaymentDate,
    openingBalance,
    closingBalance,
    totalInPeriod: inPeriod.length,
    movements: inPeriod.slice(start, start + options.limit),
  };
}
