import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  formatBATimestampISO,
  formatBAYMD,
  nowBAYMD,
  parseBAYMD,
} from '../common/utils/date.utils';
import { DriverAccountMovementType } from '../route-reconciliation/dto';
import {
  ApplyDriverCreditInterestResultDto,
  DriverCreditChargeDto,
  DriverCreditChargeStatus,
  DriverCreditListDto,
  DriverCreditPaymentResultDto,
  DriverCreditSummaryDto,
  FilterDriverCreditsDto,
  RegisterDriverCreditPaymentDto,
} from './dto/driver-credit.dto';
import {
  DriverCreditPolicy,
  allocatePayment,
  dueDateFor,
  interestFor,
  isOverdue,
  outstandingOf,
  readDriverCreditPolicy,
} from './driver-credit.rules';

const CHARGE_INCLUDE = {
  driver: { select: { name: true } },
  customer: { select: { name: true } },
} satisfies Prisma.driver_credit_chargeInclude;

type ChargeRow = Prisma.driver_credit_chargeGetPayload<{
  include: typeof CHARGE_INCLUDE;
}>;

export interface NewDriverCreditCharge {
  driverId: number;
  customerId: number;
  routeSheetId: number;
  detailId: number;
  transactionId: number;
  amount: Prisma.Decimal;
  chargedAt: Date;
  reference: string;
}

/** Convierte `YYYY-MM-DD` al valor que Prisma guarda en una columna DATE. */
function toDateColumn(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function addDays(ymd: string, days: number): string {
  const date = toDateColumn(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Cuenta corriente del chofer con clientes: cuando el cliente paga con la
 * cuenta corriente del chofer, el pedido queda pago y la deuda pasa al chofer
 * como un cargo con vencimiento propio. El interés por mora se aplica una vez
 * por cargo y se registra como un movimiento aparte.
 */
@Injectable()
export class DriverCreditService {
  private readonly policy: DriverCreditPolicy = readDriverCreditPolicy();

  constructor(private readonly prisma: PrismaService) {}

  /** Registra el cargo y el movimiento en la cuenta del chofer. */
  async createCharge(
    tx: Prisma.TransactionClient,
    input: NewDriverCreditCharge,
  ): Promise<void> {
    const dueDate = dueDateFor(
      formatBAYMD(input.chargedAt),
      this.policy.graceDays,
    );
    await tx.driver_credit_charge.create({
      data: {
        driver_id: input.driverId,
        customer_id: input.customerId,
        route_sheet_id: input.routeSheetId,
        route_sheet_detail_id: input.detailId,
        payment_transaction_id: input.transactionId,
        amount: input.amount.toFixed(2),
        due_date: toDateColumn(dueDate),
        interest_rate: this.policy.rate.toFixed(4),
        created_at: input.chargedAt,
      },
    });
    await tx.driver_account_movement.create({
      data: {
        driver_id: input.driverId,
        movement_type: DriverAccountMovementType.DRIVER_CREDIT,
        amount: input.amount.toFixed(2),
        route_sheet_id: input.routeSheetId,
        reference: input.reference,
        origin_key: `DRIVER_CREDIT:${input.transactionId}`,
        notes: `Cliente #${input.customerId} pagó con la cuenta corriente del chofer (vence ${dueDate})`,
        created_by: input.driverId,
      },
    });
  }

  /**
   * Aplica el interés a los cargos vencidos que todavía no lo tienen. La base
   * es lo que quedaba impago de cada cargo al cierre del día de vencimiento.
   * Es idempotente: cada cargo recibe interés una sola vez.
   */
  async applyDueInterest(
    driverId?: number,
    todayYmd: string = nowBAYMD(),
  ): Promise<ApplyDriverCreditInterestResultDto> {
    const due = await this.prisma.driver_credit_charge.findMany({
      where: {
        interest_applied_at: null,
        due_date: { lt: toDateColumn(todayYmd) },
        ...(driverId ? { driver_id: driverId } : {}),
      },
      orderBy: { charge_id: 'asc' },
    });

    let applied = 0;
    let totalInterest = new Prisma.Decimal(0);
    for (const charge of due) {
      const dueYmd = formatBAYMD(charge.due_date);
      if (!isOverdue(dueYmd, todayYmd)) continue;
      const cutoff = parseBAYMD(addDays(dueYmd, 1));

      const interest = await this.prisma.$transaction(async (tx) => {
        const paidByDueDate = await tx.driver_credit_allocation.aggregate({
          where: { charge_id: charge.charge_id, created_at: { lt: cutoff } },
          _sum: { amount: true },
        });
        const base = new Prisma.Decimal(charge.amount).minus(
          paidByDueDate._sum.amount ?? 0,
        );
        const unpaid = base.gt(0) ? base : new Prisma.Decimal(0);
        const amount = interestFor(
          unpaid,
          new Prisma.Decimal(charge.interest_rate),
        );
        const outstanding = outstandingOf({
          ...charge,
          interest_amount: amount,
        });

        const marked = await tx.driver_credit_charge.updateMany({
          where: { charge_id: charge.charge_id, interest_applied_at: null },
          data: {
            interest_base: unpaid.toFixed(2),
            interest_amount: amount.toFixed(2),
            interest_applied_at: new Date(),
            status: outstanding.gt(0)
              ? DriverCreditChargeStatus.OPEN
              : DriverCreditChargeStatus.SETTLED,
          },
        });
        if (marked.count !== 1 || amount.lte(0)) return null;

        await tx.driver_account_movement.create({
          data: {
            driver_id: charge.driver_id,
            movement_type: DriverAccountMovementType.DRIVER_CREDIT_INTEREST,
            amount: amount.toFixed(2),
            route_sheet_id: charge.route_sheet_id,
            reference: `CARGO-${charge.charge_id}`,
            origin_key: `DRIVER_CREDIT_INTEREST:${charge.charge_id}`,
            notes: `Interés ${new Prisma.Decimal(charge.interest_rate).mul(100).toFixed(0)}% sobre ${unpaid.toFixed(2)} impago al ${dueYmd}`,
          },
        });
        return amount;
      });

      if (interest) {
        applied += 1;
        totalInterest = totalInterest.plus(interest);
      }
    }

    return {
      date: todayYmd,
      applied,
      total_interest: totalInterest.toFixed(2),
    };
  }

  /** Cargos con filtros. Antes aplica el interés vencido del alcance pedido. */
  async listCharges(
    filters: FilterDriverCreditsDto,
  ): Promise<DriverCreditListDto> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 200);
    const today = nowBAYMD();
    await this.applyDueInterest(filters.driver_id, today);

    const scope: Prisma.driver_credit_chargeWhereInput = {
      ...(filters.driver_id ? { driver_id: filters.driver_id } : {}),
      ...(filters.customer_id ? { customer_id: filters.customer_id } : {}),
    };
    const where: Prisma.driver_credit_chargeWhereInput = { ...scope };
    if (filters.status === 'OPEN') {
      where.status = DriverCreditChargeStatus.OPEN;
    } else if (filters.status === 'SETTLED') {
      where.status = DriverCreditChargeStatus.SETTLED;
    } else if (filters.status === 'OVERDUE') {
      where.status = DriverCreditChargeStatus.OPEN;
      where.due_date = { lt: toDateColumn(today) };
    }

    const [total, rows, summary] = await Promise.all([
      this.prisma.driver_credit_charge.count({ where }),
      this.prisma.driver_credit_charge.findMany({
        where,
        include: CHARGE_INCLUDE,
        orderBy: [{ due_date: 'asc' }, { charge_id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.buildSummary(scope, today),
    ]);

    return {
      summary,
      data: rows.map((row) => this.toDto(row, today)),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  /**
   * Registra un pago del chofer y lo imputa a sus cargos abiertos. Idempotente
   * por `idempotency_key`; con la misma clave y otro monto se rechaza.
   */
  async registerPayment(
    adminId: number,
    driverId: number,
    dto: RegisterDriverCreditPaymentDto,
  ): Promise<DriverCreditPaymentResultDto> {
    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
      select: { id: true },
    });
    if (!driver) {
      throw new NotFoundException(`Chofer ${driverId} no encontrado`);
    }

    const originKey = `DRIVER_CREDIT_PAYMENT:${driverId}:${dto.idempotency_key}`;
    const amount = new Prisma.Decimal(dto.amount);
    const replay = await this.findPaymentReplay(originKey, amount, driverId);
    if (replay) return replay;

    const today = nowBAYMD();
    await this.applyDueInterest(driverId, today);

    let movementId: number;
    let allocations: { charge_id: number; amount: Prisma.Decimal }[];
    try {
      ({ movementId, allocations } = await this.prisma.$transaction(
        async (tx) => {
          // Bloquea los cargos abiertos del chofer para que dos pagos simultáneos
          // no imputen dos veces el mismo saldo.
          await tx.$queryRaw`SELECT charge_id FROM driver_credit_charge WHERE driver_id = ${driverId} AND status = 'OPEN' FOR UPDATE`;
          const open = await tx.driver_credit_charge.findMany({
            where: {
              driver_id: driverId,
              status: DriverCreditChargeStatus.OPEN,
              ...(dto.charge_ids?.length
                ? { charge_id: { in: dto.charge_ids } }
                : {}),
            },
            orderBy: [{ due_date: 'asc' }, { charge_id: 'asc' }],
          });

          let ordered = open;
          if (dto.charge_ids?.length) {
            const byId = new Map(
              open.map((charge) => [charge.charge_id, charge]),
            );
            const missing = dto.charge_ids.filter((id) => !byId.has(id));
            if (missing.length > 0) {
              throw new ConflictException(
                `Los cargos ${missing.join(', ')} no existen, no son del chofer o ya están saldados`,
              );
            }
            ordered = dto.charge_ids.map((id) => byId.get(id));
          }

          const owed = ordered.reduce(
            (sum, charge) => sum.plus(outstandingOf(charge)),
            new Prisma.Decimal(0),
          );
          if (amount.gt(owed)) {
            throw new ConflictException(
              `El pago supera la deuda pendiente en cuenta corriente (${owed.toFixed(2)})`,
            );
          }

          const plan = allocatePayment(ordered, amount);
          const movement = await tx.driver_account_movement.create({
            data: {
              driver_id: driverId,
              movement_type: DriverAccountMovementType.DRIVER_CREDIT_PAYMENT,
              amount: amount.neg().toFixed(2),
              reference: plan
                .map((a) => `CARGO-${a.charge_id}`)
                .join(',')
                .slice(0, 80),
              origin_key: originKey,
              notes: dto.notes ?? null,
              created_by: adminId,
            },
          });

          for (const allocation of plan) {
            const charge = ordered.find(
              (c) => c.charge_id === allocation.charge_id,
            );
            const settled = new Prisma.Decimal(charge.settled_amount).plus(
              allocation.amount,
            );
            const remaining = outstandingOf({
              ...charge,
              settled_amount: settled,
            });
            await tx.driver_credit_allocation.create({
              data: {
                charge_id: allocation.charge_id,
                movement_id: movement.movement_id,
                amount: allocation.amount.toFixed(2),
              },
            });
            await tx.driver_credit_charge.update({
              where: { charge_id: allocation.charge_id },
              data: {
                settled_amount: settled.toFixed(2),
                status: remaining.gt(0)
                  ? DriverCreditChargeStatus.OPEN
                  : DriverCreditChargeStatus.SETTLED,
              },
            });
          }
          return { movementId: movement.movement_id, allocations: plan };
        },
      ));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.findPaymentReplay(originKey, amount, driverId);
        if (raced) return raced;
      }
      throw error;
    }

    return {
      movement_id: movementId,
      amount: amount.toFixed(2),
      allocations: allocations.map((a) => ({
        charge_id: a.charge_id,
        amount: a.amount.toFixed(2),
      })),
      idempotent_replay: false,
      summary: await this.buildSummary({ driver_id: driverId }, today),
    };
  }

  private async findPaymentReplay(
    originKey: string,
    amount: Prisma.Decimal,
    driverId: number,
  ): Promise<DriverCreditPaymentResultDto | null> {
    const existing = await this.prisma.driver_account_movement.findUnique({
      where: { origin_key: originKey },
      include: { allocations: { orderBy: { allocation_id: 'asc' } } },
    });
    if (!existing) return null;
    if (!new Prisma.Decimal(existing.amount).neg().equals(amount)) {
      throw new ConflictException(
        'La clave de idempotencia ya fue usada con otro monto',
      );
    }
    return {
      movement_id: existing.movement_id,
      amount: amount.toFixed(2),
      allocations: existing.allocations.map((a) => ({
        charge_id: a.charge_id,
        amount: new Prisma.Decimal(a.amount).toFixed(2),
      })),
      idempotent_replay: true,
      summary: await this.buildSummary({ driver_id: driverId }, nowBAYMD()),
    };
  }

  private async buildSummary(
    scope: Prisma.driver_credit_chargeWhereInput,
    today: string,
  ): Promise<DriverCreditSummaryDto> {
    const [open, interest] = await Promise.all([
      this.prisma.driver_credit_charge.findMany({
        where: { ...scope, status: DriverCreditChargeStatus.OPEN },
        select: {
          charge_id: true,
          amount: true,
          settled_amount: true,
          interest_amount: true,
          due_date: true,
        },
      }),
      this.prisma.driver_credit_charge.aggregate({
        where: scope,
        _sum: { interest_amount: true },
      }),
    ]);

    let outstanding = new Prisma.Decimal(0);
    let overdue = new Prisma.Decimal(0);
    for (const charge of open) {
      const value = outstandingOf(charge);
      outstanding = outstanding.plus(value);
      if (isOverdue(formatBAYMD(charge.due_date), today)) {
        overdue = overdue.plus(value);
      }
    }
    return {
      outstanding: outstanding.toFixed(2),
      overdue: overdue.toFixed(2),
      interest_applied: new Prisma.Decimal(
        interest._sum.interest_amount ?? 0,
      ).toFixed(2),
      open_charges: open.length,
    };
  }

  private toDto(row: ChargeRow, today: string): DriverCreditChargeDto {
    const dueDate = formatBAYMD(row.due_date);
    const status = row.status as DriverCreditChargeStatus;
    return {
      charge_id: row.charge_id,
      driver_id: row.driver_id,
      driver_name: row.driver?.name ?? null,
      customer_id: row.customer_id,
      customer_name: row.customer?.name ?? null,
      route_sheet_id: row.route_sheet_id,
      route_sheet_detail_id: row.route_sheet_detail_id,
      payment_transaction_id: row.payment_transaction_id,
      charge_date: formatBAYMD(row.created_at),
      due_date: dueDate,
      amount: new Prisma.Decimal(row.amount).toFixed(2),
      settled_amount: new Prisma.Decimal(row.settled_amount).toFixed(2),
      interest_rate: new Prisma.Decimal(row.interest_rate).toFixed(4),
      interest_base:
        row.interest_base === null
          ? null
          : new Prisma.Decimal(row.interest_base).toFixed(2),
      interest_amount:
        row.interest_amount === null
          ? null
          : new Prisma.Decimal(row.interest_amount).toFixed(2),
      interest_applied_at: row.interest_applied_at
        ? formatBATimestampISO(row.interest_applied_at)
        : null,
      outstanding: outstandingOf(row).toFixed(2),
      status,
      overdue:
        status === DriverCreditChargeStatus.OPEN && isOverdue(dueDate, today),
    };
  }
}
