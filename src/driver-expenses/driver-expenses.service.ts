import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RouteSheetExecutionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  endOfDayBA,
  formatBATimestampISO,
  parseBAYMD,
} from '../common/utils/date.utils';
import {
  CreateDriverExpenseDto,
  DriverExpenseCategory,
  DriverExpenseDto,
  DriverExpenseListDto,
  FilterDriverExpensesDto,
  VoidDriverExpenseDto,
} from './dto/driver-expense.dto';

const EXPENSE_INCLUDE = {
  driver: { select: { name: true } },
} satisfies Prisma.driver_expenseInclude;

type ExpenseRow = Prisma.driver_expenseGetPayload<{
  include: typeof EXPENSE_INCLUDE;
}>;

/**
 * Gastos ocasionales del chofer (combustible, gomería, etc.). Se cargan sobre
 * la hoja de ruta mientras no esté rendida y se descuentan del efectivo que el
 * chofer rinde al cerrar el día.
 */
@Injectable()
export class DriverExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    driverId: number,
    routeSheetId: number,
    dto: CreateDriverExpenseDto,
  ): Promise<DriverExpenseDto> {
    const description = dto.description?.trim() || null;
    if (dto.category === DriverExpenseCategory.OTRO && !description) {
      throw new BadRequestException(
        'Para un gasto de tipo OTRO hay que indicar la descripción',
      );
    }
    const amount = new Prisma.Decimal(dto.amount);

    const replay = await this.findReplay(
      dto.idempotency_key,
      driverId,
      routeSheetId,
      amount,
    );
    if (replay) return replay;

    await this.assertEditableSheet(driverId, routeSheetId);
    try {
      const created = await this.prisma.driver_expense.create({
        data: {
          route_sheet_id: routeSheetId,
          driver_id: driverId,
          category: dto.category,
          amount: amount.toFixed(2),
          description,
          receipt_reference: dto.receipt_reference?.trim() || null,
          idempotency_key: dto.idempotency_key,
        },
        include: EXPENSE_INCLUDE,
      });
      return this.toDto(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.findReplay(
          dto.idempotency_key,
          driverId,
          routeSheetId,
          amount,
        );
        if (raced) return raced;
      }
      throw error;
    }
  }

  async listForSheet(
    driverId: number,
    routeSheetId: number,
  ): Promise<DriverExpenseListDto> {
    await this.loadOwnedSheet(driverId, routeSheetId);
    return this.findAll({
      route_sheet_id: routeSheetId,
      driver_id: driverId,
      limit: 200,
    });
  }

  /** El chofer anula un gasto propio mientras la hoja no esté rendida. */
  async void(
    driverId: number,
    routeSheetId: number,
    expenseId: number,
    dto: VoidDriverExpenseDto,
  ): Promise<DriverExpenseDto> {
    await this.assertEditableSheet(driverId, routeSheetId);
    const updated = await this.prisma.driver_expense.updateMany({
      where: {
        expense_id: expenseId,
        route_sheet_id: routeSheetId,
        driver_id: driverId,
        is_active: true,
      },
      data: {
        is_active: false,
        voided_by: driverId,
        voided_at: new Date(),
        void_reason: dto.reason?.trim() || null,
      },
    });
    const expense = await this.prisma.driver_expense.findFirst({
      where: {
        expense_id: expenseId,
        route_sheet_id: routeSheetId,
        driver_id: driverId,
      },
      include: EXPENSE_INCLUDE,
    });
    if (!expense) {
      throw new NotFoundException(`Gasto ${expenseId} no encontrado`);
    }
    if (updated.count === 0) {
      throw new ConflictException(`El gasto ${expenseId} ya estaba anulado`);
    }
    return this.toDto(expense);
  }

  async findAll(
    filters: FilterDriverExpensesDto,
  ): Promise<DriverExpenseListDto> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 200);
    const where: Prisma.driver_expenseWhereInput = {
      ...(filters.driver_id ? { driver_id: filters.driver_id } : {}),
      ...(filters.route_sheet_id
        ? { route_sheet_id: filters.route_sheet_id }
        : {}),
      ...(filters.category ? { category: filters.category } : {}),
    };
    if (filters.date_from || filters.date_to) {
      where.created_at = {
        ...(filters.date_from
          ? { gte: parseBAYMD(filters.date_from.slice(0, 10)) }
          : {}),
        ...(filters.date_to
          ? { lte: endOfDayBA(parseBAYMD(filters.date_to.slice(0, 10))) }
          : {}),
      };
    }

    const [total, rows, sum] = await Promise.all([
      this.prisma.driver_expense.count({ where }),
      this.prisma.driver_expense.findMany({
        where,
        include: EXPENSE_INCLUDE,
        orderBy: [{ created_at: 'desc' }, { expense_id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.driver_expense.aggregate({
        where: { ...where, is_active: true },
        _sum: { amount: true },
      }),
    ]);

    return {
      total_amount: new Prisma.Decimal(sum._sum.amount ?? 0).toFixed(2),
      data: rows.map((row) => this.toDto(row)),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  private async findReplay(
    idempotencyKey: string,
    driverId: number,
    routeSheetId: number,
    amount: Prisma.Decimal,
  ): Promise<DriverExpenseDto | null> {
    const existing = await this.prisma.driver_expense.findUnique({
      where: { idempotency_key: idempotencyKey },
      include: EXPENSE_INCLUDE,
    });
    if (!existing) return null;
    if (
      existing.driver_id !== driverId ||
      existing.route_sheet_id !== routeSheetId ||
      !new Prisma.Decimal(existing.amount).equals(amount)
    ) {
      throw new ConflictException(
        'La clave de idempotencia ya fue usada con otro contenido',
      );
    }
    return this.toDto(existing);
  }

  private async loadOwnedSheet(driverId: number, routeSheetId: number) {
    const sheet = await this.prisma.route_sheet.findFirst({
      where: {
        route_sheet_id: routeSheetId,
        driver_id: driverId,
        is_active: true,
      },
      select: { execution_status: true, reconciliation_at: true },
    });
    if (!sheet) {
      throw new NotFoundException(`Hoja de ruta ${routeSheetId} no encontrada`);
    }
    return sheet;
  }

  private async assertEditableSheet(driverId: number, routeSheetId: number) {
    const sheet = await this.loadOwnedSheet(driverId, routeSheetId);
    if (
      sheet.reconciliation_at ||
      sheet.execution_status === RouteSheetExecutionStatus.CLOSED
    ) {
      throw new ConflictException(
        'La hoja de ruta ya fue rendida: los gastos no se pueden modificar',
      );
    }
  }

  private toDto(row: ExpenseRow): DriverExpenseDto {
    return {
      expense_id: row.expense_id,
      route_sheet_id: row.route_sheet_id,
      driver_id: row.driver_id,
      driver_name: row.driver?.name ?? null,
      category: row.category as DriverExpenseCategory,
      amount: new Prisma.Decimal(row.amount).toFixed(2),
      description: row.description ?? null,
      receipt_reference: row.receipt_reference ?? null,
      created_at: formatBATimestampISO(row.created_at),
      is_active: row.is_active,
      void_reason: row.void_reason ?? null,
    };
  }
}
