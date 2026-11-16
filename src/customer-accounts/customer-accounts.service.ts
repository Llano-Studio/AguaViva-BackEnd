import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountMovementSide,
  CustomerAccountAdjustmentKind,
  Prisma,
  customer_account_adjustment,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { nowBAYMD, parseUTCYMD } from '../common/utils/date.utils';
import {
  AccountMovement,
  AccountMovementConcept,
  StatementMovement,
  buildStatement,
  dateOnlyMoment,
} from './account-statement';
import { CustomerAccountSourcesService } from './customer-account-sources.service';
import {
  AccountAdjustmentResponseDto,
  CreateAccountAdjustmentDto,
  CustomerAccountMovementDto,
  CustomerAccountQueryDto,
  CustomerAccountResponseDto,
  ImportOpeningBalancesDto,
  OpeningBalanceImportErrorDto,
  OpeningBalanceImportResultDto,
  VoidAccountAdjustmentDto,
} from './dto/customer-account.dto';

const DEFAULT_LIMIT = 50;

@Injectable()
export class CustomerAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sources: CustomerAccountSourcesService,
  ) {}

  async getAccount(
    customerId: number,
    query: CustomerAccountQueryDto,
  ): Promise<CustomerAccountResponseDto> {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('from no puede ser posterior a to');
    }
    const customer = await this.findCustomerOrThrow(customerId);
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const statement = buildStatement(await this.collectMovements(customerId), {
      from: query.from,
      to: query.to,
      page,
      limit,
    });
    const balance = statement.balance;

    return {
      customer,
      summary: {
        balance: balance.toFixed(2),
        debt: (balance.gt(0) ? balance : new Prisma.Decimal(0)).toFixed(2),
        credit: (balance.lt(0) ? balance.neg() : new Prisma.Decimal(0)).toFixed(
          2,
        ),
        total_debits: statement.totalDebits.toFixed(2),
        total_credits: statement.totalCredits.toFixed(2),
        last_payment_date: statement.lastPaymentDate,
      },
      period: {
        from: query.from ?? null,
        to: query.to ?? null,
        opening_balance: statement.openingBalance.toFixed(2),
        closing_balance: statement.closingBalance.toFixed(2),
      },
      movements: {
        data: statement.movements.map((movement) =>
          this.toMovementDto(movement),
        ),
        total: statement.totalInPeriod,
        page,
        limit,
      },
    };
  }

  /** Saldo actual del cliente: positivo = debe, negativo = saldo a favor. */
  async getBalance(customerId: number): Promise<Prisma.Decimal> {
    const statement = buildStatement(await this.collectMovements(customerId), {
      page: 1,
      limit: 1,
    });
    return statement.balance;
  }

  async createAdjustment(
    customerId: number,
    dto: CreateAccountAdjustmentDto,
    userId: number,
  ): Promise<AccountAdjustmentResponseDto> {
    await this.findCustomerOrThrow(customerId);
    const adjustment = await this.prisma.customer_account_adjustment.create({
      data: {
        customer_id: customerId,
        kind: CustomerAccountAdjustmentKind.MANUAL,
        side: dto.side,
        amount: new Prisma.Decimal(dto.amount),
        movement_date: this.parseDate(dto.movement_date ?? nowBAYMD()),
        description: dto.description.trim(),
        created_by: userId,
      },
    });
    return this.toAdjustmentDto(adjustment);
  }

  async voidAdjustment(
    adjustmentId: number,
    dto: VoidAccountAdjustmentDto,
    userId: number,
  ): Promise<AccountAdjustmentResponseDto> {
    const result = await this.prisma.customer_account_adjustment.updateMany({
      where: { adjustment_id: adjustmentId, is_active: true },
      data: {
        is_active: false,
        voided_by: userId,
        voided_at: new Date(),
        void_reason: dto.reason.trim(),
      },
    });
    if (result.count !== 1) {
      const exists = await this.prisma.customer_account_adjustment.findUnique({
        where: { adjustment_id: adjustmentId },
        select: { adjustment_id: true },
      });
      if (!exists) {
        throw new NotFoundException(`Ajuste ${adjustmentId} no encontrado`);
      }
      throw new ConflictException(
        `El ajuste ${adjustmentId} ya estaba anulado`,
      );
    }
    const adjustment =
      await this.prisma.customer_account_adjustment.findUniqueOrThrow({
        where: { adjustment_id: adjustmentId },
      });
    return this.toAdjustmentDto(adjustment);
  }

  /**
   * Carga la deuda anterior al sistema (Excel) como saldo inicial de cada
   * cliente. Es todo o nada: si alguna fila tiene error no se guarda ninguna.
   * Con dry_run (por defecto) solo devuelve el reporte.
   */
  async importOpeningBalances(
    dto: ImportOpeningBalancesDto,
    userId: number,
  ): Promise<OpeningBalanceImportResultDto> {
    const dryRun = dto.dry_run ?? true;
    const movementDate = this.parseDate(dto.movement_date);
    const errors: OpeningBalanceImportErrorDto[] = [];
    const rowNumber = (index: number) => dto.rows[index].row ?? index + 1;

    const byId = new Set<number>();
    const byDigits = new Set<string>();
    dto.rows.forEach((row, index) => {
      const hasId = row.customer_id !== undefined;
      const digits = this.phoneDigits(row.phone);
      if (hasId === Boolean(digits)) {
        errors.push({
          row: rowNumber(index),
          message:
            'Indicá customer_id o phone (uno solo, el teléfono con dígitos)',
        });
      } else if (hasId) {
        byId.add(row.customer_id);
      } else {
        byDigits.add(digits);
      }
    });

    const [personsById, personsByDigits] = await Promise.all([
      this.prisma.person.findMany({
        where: { person_id: { in: [...byId] } },
        select: { person_id: true },
      }),
      byDigits.size
        ? this.prisma.$queryRaw<{ person_id: number; digits: string }[]>`
            SELECT person_id, regexp_replace(phone, '\\D', '', 'g') AS digits
            FROM person
            WHERE regexp_replace(phone, '\\D', '', 'g') = ANY(${[...byDigits]})`
        : Promise.resolve([]),
    ]);
    const knownIds = new Set(personsById.map((p) => p.person_id));
    const idsByDigits = new Map<string, number[]>();
    for (const { person_id, digits } of personsByDigits) {
      idsByDigits.set(digits, [...(idsByDigits.get(digits) ?? []), person_id]);
    }

    const resolved: {
      index: number;
      customerId: number;
      amount: Prisma.Decimal;
    }[] = [];
    let skippedZero = 0;
    const seen = new Map<number, number>();
    dto.rows.forEach((row, index) => {
      const digits = this.phoneDigits(row.phone);
      if ((row.customer_id !== undefined) === Boolean(digits)) return;

      let customerId: number | undefined;
      if (row.customer_id !== undefined) {
        if (!knownIds.has(row.customer_id)) {
          errors.push({
            row: rowNumber(index),
            message: `No existe el cliente ${row.customer_id}`,
          });
          return;
        }
        customerId = row.customer_id;
      } else {
        const matches = idsByDigits.get(digits) ?? [];
        if (matches.length !== 1) {
          errors.push({
            row: rowNumber(index),
            message:
              matches.length === 0
                ? `Ningún cliente tiene el teléfono ${row.phone}`
                : `El teléfono ${row.phone} corresponde a varios clientes (${matches.join(', ')}); usá customer_id`,
          });
          return;
        }
        customerId = matches[0];
      }

      if (seen.has(customerId)) {
        errors.push({
          row: rowNumber(index),
          message: `El cliente ${customerId} ya aparece en la fila ${seen.get(customerId)}`,
        });
        return;
      }
      seen.set(customerId, rowNumber(index));

      const amount = new Prisma.Decimal(row.amount);
      if (amount.isZero()) {
        skippedZero += 1;
        return;
      }
      resolved.push({ index, customerId, amount });
    });

    const existing = await this.prisma.customer_account_adjustment.findMany({
      where: {
        customer_id: { in: resolved.map((r) => r.customerId) },
        kind: CustomerAccountAdjustmentKind.OPENING_BALANCE,
        is_active: true,
      },
      select: { customer_id: true, adjustment_id: true },
    });
    const existingByCustomer = new Map(
      existing.map((e) => [e.customer_id, e.adjustment_id]),
    );
    for (const r of resolved) {
      const previous = existingByCustomer.get(r.customerId);
      if (previous !== undefined) {
        errors.push({
          row: rowNumber(r.index),
          message: `El cliente ${r.customerId} ya tiene saldo inicial (ajuste ${previous}); anulalo antes de volver a cargarlo`,
        });
      }
    }

    errors.sort((a, b) => a.row - b.row);
    const totalDebit = resolved
      .filter((r) => r.amount.gt(0))
      .reduce((sum, r) => sum.plus(r.amount), new Prisma.Decimal(0));
    const totalCredit = resolved
      .filter((r) => r.amount.lt(0))
      .reduce((sum, r) => sum.plus(r.amount.neg()), new Prisma.Decimal(0));

    const result: OpeningBalanceImportResultDto = {
      dry_run: dryRun,
      total_rows: dto.rows.length,
      valid_rows: errors.length ? 0 : resolved.length,
      skipped_zero_rows: skippedZero,
      total_debit: totalDebit.toFixed(2),
      total_credit: totalCredit.toFixed(2),
      created: 0,
      errors,
    };

    if (errors.length) {
      if (dryRun) return result;
      throw new BadRequestException({
        statusCode: 400,
        message: 'La importación tiene errores: no se guardó ningún saldo',
        ...result,
      });
    }
    if (dryRun) return result;

    const description = `Saldo inicial (${dto.source_reference.trim()})`;
    const created = await this.prisma.$transaction(async (tx) => {
      const race = await tx.customer_account_adjustment.count({
        where: {
          customer_id: { in: resolved.map((r) => r.customerId) },
          kind: CustomerAccountAdjustmentKind.OPENING_BALANCE,
          is_active: true,
        },
      });
      if (race > 0) {
        throw new ConflictException(
          'Otra carga de saldos iniciales se guardó mientras tanto. Volvé a validar.',
        );
      }
      return tx.customer_account_adjustment.createMany({
        data: resolved.map((r) => ({
          customer_id: r.customerId,
          kind: CustomerAccountAdjustmentKind.OPENING_BALANCE,
          side: r.amount.gt(0)
            ? AccountMovementSide.DEBIT
            : AccountMovementSide.CREDIT,
          amount: r.amount.abs(),
          movement_date: movementDate,
          description: dto.rows[r.index].description?.trim() || description,
          source_reference: dto.source_reference.trim(),
          created_by: userId,
        })),
      });
    });
    return { ...result, created: created.count };
  }

  private async collectMovements(
    customerId: number,
  ): Promise<AccountMovement[]> {
    const [documents, adjustments] = await Promise.all([
      this.sources.collect(customerId),
      this.prisma.customer_account_adjustment.findMany({
        where: { customer_id: customerId, is_active: true },
      }),
    ]);
    return [
      ...documents,
      ...adjustments.map((a) => this.adjustmentMovement(a)),
    ];
  }

  private adjustmentMovement(
    adjustment: customer_account_adjustment,
  ): AccountMovement {
    const isOpening =
      adjustment.kind === CustomerAccountAdjustmentKind.OPENING_BALANCE;
    return {
      key: `ADJUSTMENT-${adjustment.adjustment_id}`,
      ...dateOnlyMoment(adjustment.movement_date),
      side: adjustment.side,
      concept: isOpening
        ? AccountMovementConcept.OPENING_BALANCE
        : AccountMovementConcept.ADJUSTMENT,
      reference_id: adjustment.adjustment_id,
      description: adjustment.description,
      amount: new Prisma.Decimal(adjustment.amount),
      payment_method: null,
    };
  }

  private async findCustomerOrThrow(customerId: number) {
    const customer = await this.prisma.person.findUnique({
      where: { person_id: customerId },
      select: { person_id: true, name: true, phone: true },
    });
    if (!customer) {
      throw new NotFoundException(`Cliente ${customerId} no encontrado`);
    }
    return { ...customer, name: customer.name ?? null };
  }

  private toMovementDto(
    movement: StatementMovement,
  ): CustomerAccountMovementDto {
    const amount = movement.amount.toFixed(2);
    const isDebit = movement.side === AccountMovementSide.DEBIT;
    return {
      key: movement.key,
      date: movement.date,
      side: movement.side,
      concept: movement.concept,
      reference_id: movement.reference_id,
      description: movement.description,
      amount,
      debit: isDebit ? amount : null,
      credit: isDebit ? null : amount,
      balance: movement.balance.toFixed(2),
      payment_method: movement.payment_method,
    };
  }

  private toAdjustmentDto(
    adjustment: customer_account_adjustment,
  ): AccountAdjustmentResponseDto {
    return {
      adjustment_id: adjustment.adjustment_id,
      customer_id: adjustment.customer_id,
      kind: adjustment.kind,
      side: adjustment.side,
      amount: new Prisma.Decimal(adjustment.amount).toFixed(2),
      movement_date: dateOnlyMoment(adjustment.movement_date).date,
      description: adjustment.description,
      source_reference: adjustment.source_reference ?? null,
      is_active: adjustment.is_active,
      void_reason: adjustment.void_reason ?? null,
    };
  }

  private parseDate(value: string): Date {
    try {
      return parseUTCYMD(value);
    } catch {
      throw new BadRequestException(`Fecha inválida: ${value}. Use YYYY-MM-DD`);
    }
  }

  private phoneDigits(phone?: string): string | null {
    const digits = (phone ?? '').replace(/\D/g, '');
    return digits.length ? digits : null;
  }
}
