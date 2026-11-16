import { Prisma } from '@prisma/client';

/**
 * Reglas de la cuenta corriente del chofer. Cuando el chofer deja que un
 * cliente pague con su cuenta corriente, la deuda pasa al chofer como un cargo
 * independiente. Cada cargo vence el día `dueDay` del mes siguiente al cargo;
 * si después de esa fecha sigue impago, se le aplica una sola vez el interés
 * sobre lo que quede impago de ese cargo (nunca sobre el total de la cuenta).
 */
export const DRIVER_CREDIT_DEFAULT_RATE = '0.20';
export const DRIVER_CREDIT_DEFAULT_DUE_DAY = 10;

export interface DriverCreditPolicy {
  rate: Prisma.Decimal;
  dueDay: number;
}

/** Lee la política desde el entorno, con los valores acordados por defecto. */
export function readDriverCreditPolicy(
  env: NodeJS.ProcessEnv = process.env,
): DriverCreditPolicy {
  const rawRate = env.DRIVER_CREDIT_INTEREST_RATE?.trim();
  const rawDueDay = env.DRIVER_CREDIT_DUE_DAY?.trim();
  const rate = new Prisma.Decimal(rawRate || DRIVER_CREDIT_DEFAULT_RATE);
  const dueDay = rawDueDay ? Number(rawDueDay) : DRIVER_CREDIT_DEFAULT_DUE_DAY;
  if (rate.lt(0) || rate.gt(1)) {
    throw new Error('DRIVER_CREDIT_INTEREST_RATE debe estar entre 0 y 1');
  }
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
    throw new Error('DRIVER_CREDIT_DUE_DAY debe ser un día entre 1 y 28');
  }
  return { rate, dueDay };
}

/**
 * Fecha de vencimiento (`YYYY-MM-DD`) de un cargo tomado el día `chargeYmd`
 * (fecha de Buenos Aires): el día `dueDay` del mes siguiente.
 */
export function dueDateFor(chargeYmd: string, dueDay: number): string {
  const [year, month] = chargeYmd.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
}

/** El interés corresponde recién el día siguiente al vencimiento. */
export function isOverdue(dueYmd: string, todayYmd: string): boolean {
  return todayYmd > dueYmd;
}

/** Interés de un cargo: tasa sobre lo impago de ese cargo, a 2 decimales. */
export function interestFor(
  unpaid: Prisma.Decimal,
  rate: Prisma.Decimal,
): Prisma.Decimal {
  if (unpaid.lte(0)) return new Prisma.Decimal(0);
  return unpaid.mul(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export interface OpenCharge {
  charge_id: number;
  amount: Prisma.Decimal;
  settled_amount: Prisma.Decimal;
  interest_amount: Prisma.Decimal | null;
}

/** Saldo pendiente de un cargo: capital más interés menos lo pagado. */
export function outstandingOf(charge: OpenCharge): Prisma.Decimal {
  const outstanding = new Prisma.Decimal(charge.amount)
    .plus(charge.interest_amount ?? 0)
    .minus(charge.settled_amount);
  return outstanding.gt(0) ? outstanding : new Prisma.Decimal(0);
}

/**
 * Reparte un pago entre los cargos en el orden recibido (el llamador los pasa
 * del más viejo al más nuevo). Devuelve cuánto se imputa a cada cargo.
 */
export function allocatePayment(
  charges: OpenCharge[],
  amount: Prisma.Decimal,
): { charge_id: number; amount: Prisma.Decimal }[] {
  let remaining = new Prisma.Decimal(amount);
  const allocations: { charge_id: number; amount: Prisma.Decimal }[] = [];
  for (const charge of charges) {
    if (remaining.lte(0)) break;
    const outstanding = outstandingOf(charge);
    if (outstanding.lte(0)) continue;
    const applied = Prisma.Decimal.min(outstanding, remaining);
    allocations.push({ charge_id: charge.charge_id, amount: applied });
    remaining = remaining.minus(applied);
  }
  return allocations;
}
