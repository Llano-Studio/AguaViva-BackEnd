import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RouteSheetExecutionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryStatus } from '../common/constants/enums';
import {
  formatBATimestampISO,
  formatBAYMD,
  nowBAYMD,
  parseUTCYMD,
} from '../common/utils/date.utils';
import {
  DriverDeliveryCustomerDto,
  DriverRouteSheetDeliveryDto,
  DriverRouteSheetDetailDto,
  DriverRouteSheetPauseDto,
  DriverRouteSheetSummaryDto,
  DriverStopType,
  FilterDriverRouteSheetsDto,
  PauseRouteSheetDto,
} from './dto';

/** Estados de entrega que ya no requieren acción del chofer. */
export const RESOLVED_DELIVERY_STATUSES: ReadonlySet<string> = new Set([
  DeliveryStatus.DELIVERED,
  DeliveryStatus.FAILED,
  DeliveryStatus.SKIPPED,
]);

const NOT_DELIVERED_STATUSES: ReadonlySet<string> = new Set([
  DeliveryStatus.FAILED,
  DeliveryStatus.SKIPPED,
]);

const OPEN_EXECUTION_STATUSES: RouteSheetExecutionStatus[] = [
  RouteSheetExecutionStatus.IN_PROGRESS,
  RouteSheetExecutionStatus.PAUSED,
];

const DETAIL_ORDER_BY: Prisma.route_sheet_detailOrderByWithRelationInput[] = [
  { sequence_number: { sort: 'asc', nulls: 'last' } },
  { route_sheet_detail_id: 'asc' },
];

const OPEN_PAUSE_INCLUDE = {
  where: { resumed_at: null },
  orderBy: { paused_at: 'desc' },
  take: 1,
} satisfies Prisma.route_sheet$route_sheet_pauseArgs;

const CUSTOMER_SELECT = {
  person_id: true,
  name: true,
  alias: true,
  address: true,
  phone: true,
} satisfies Prisma.personSelect;

const SUMMARY_INCLUDE = {
  vehicle: { select: { vehicle_id: true, code: true, name: true } },
  route_sheet_pause: OPEN_PAUSE_INCLUDE,
  route_sheet_detail: {
    select: { delivery_status: true, delivery_time: true },
  },
} satisfies Prisma.route_sheetInclude;

const DETAIL_INCLUDE = {
  vehicle: { select: { vehicle_id: true, code: true, name: true } },
  route_sheet_pause: OPEN_PAUSE_INCLUDE,
  route_sheet_detail: {
    orderBy: DETAIL_ORDER_BY,
    include: {
      order_header: {
        select: {
          order_id: true,
          total_amount: true,
          paid_amount: true,
          customer: { select: CUSTOMER_SELECT },
        },
      },
      one_off_purchase: {
        select: {
          purchase_id: true,
          total_amount: true,
          paid_amount: true,
          delivery_address: true,
          person: { select: CUSTOMER_SELECT },
        },
      },
      one_off_purchase_header: {
        select: {
          purchase_header_id: true,
          total_amount: true,
          paid_amount: true,
          delivery_address: true,
          person: { select: CUSTOMER_SELECT },
        },
      },
      cancellation_order: {
        select: {
          cancellation_order_id: true,
          customer_subscription: { select: { person: { select: CUSTOMER_SELECT } } },
        },
      },
      cycle_payment: {
        select: {
          payment_id: true,
          subscription_cycle: {
            select: {
              total_amount: true,
              paid_amount: true,
              customer_subscription: { select: { person: { select: CUSTOMER_SELECT } } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.route_sheetInclude;

type SummaryRow = Prisma.route_sheetGetPayload<{
  include: typeof SUMMARY_INCLUDE;
}>;
type DetailRow = Prisma.route_sheetGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;
type CustomerRow = Prisma.personGetPayload<{ select: typeof CUSTOMER_SELECT }>;
type DetailItemRow = DetailRow['route_sheet_detail'][number];

interface StopInfo {
  stop_type: DriverStopType;
  reference_id: number | null;
  order_id: number | null;
  total_amount: Prisma.Decimal | null;
  paid_amount: Prisma.Decimal | null;
  customer: CustomerRow | null;
  delivery_address: string | null;
}

/** Resuelve qué es cada parada (pedido, compra única, retiro o cobranza) y de qué cliente. */
export function resolveStop(detail: DetailItemRow): StopInfo {
  if (detail.order_header) {
    const order = detail.order_header;
    return {
      stop_type: DriverStopType.ORDER,
      reference_id: order.order_id,
      order_id: order.order_id,
      total_amount: order.total_amount,
      paid_amount: order.paid_amount,
      customer: order.customer,
      delivery_address: null,
    };
  }
  const purchase = detail.one_off_purchase_header ?? detail.one_off_purchase;
  if (purchase) {
    return {
      stop_type: DriverStopType.ONE_OFF,
      reference_id:
        'purchase_header_id' in purchase
          ? purchase.purchase_header_id
          : purchase.purchase_id,
      order_id: null,
      total_amount: purchase.total_amount,
      paid_amount: purchase.paid_amount,
      customer: purchase.person,
      delivery_address: purchase.delivery_address ?? null,
    };
  }
  if (detail.cancellation_order) {
    return {
      stop_type: DriverStopType.CANCELLATION,
      reference_id: detail.cancellation_order.cancellation_order_id,
      order_id: null,
      total_amount: null,
      paid_amount: null,
      customer: detail.cancellation_order.customer_subscription.person,
      delivery_address: null,
    };
  }
  if (detail.cycle_payment) {
    const cycle = detail.cycle_payment.subscription_cycle;
    return {
      stop_type: DriverStopType.COLLECTION,
      reference_id: detail.cycle_payment.payment_id,
      order_id: null,
      total_amount: cycle.total_amount,
      paid_amount: cycle.paid_amount,
      customer: cycle.customer_subscription.person,
      delivery_address: null,
    };
  }
  return {
    stop_type: DriverStopType.ORDER,
    reference_id: null,
    order_id: null,
    total_amount: null,
    paid_amount: null,
    customer: null,
    delivery_address: null,
  };
}

/**
 * Marca cuál es la entrega habilitada: la primera sin resolver en el orden
 * del recorrido, y solo si la hoja está en curso. Las demás pendientes quedan
 * bloqueadas hasta resolver la anterior.
 */
export function computeDeliveryLocks(
  statuses: string[],
  executionStatus: RouteSheetExecutionStatus,
): { currentIndex: number | null; resolved: boolean[] } {
  const resolved = statuses.map((s) => RESOLVED_DELIVERY_STATUSES.has(s));
  const firstPending = resolved.indexOf(false);
  const currentIndex =
    executionStatus === RouteSheetExecutionStatus.IN_PROGRESS &&
    firstPending !== -1
      ? firstPending
      : null;
  return { currentIndex, resolved };
}

@Injectable()
export class DriverRouteSheetsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Hojas de ruta del chofer para una fecha. Para el día de hoy también
   * incluye hojas de días anteriores que quedaron en curso o pausadas.
   */
  async findForDriver(
    driverId: number,
    filters: FilterDriverRouteSheetsDto,
  ): Promise<DriverRouteSheetSummaryDto[]> {
    const today = nowBAYMD();
    const date = filters.date ?? today;
    const deliveryDate = this.parseDate(date);

    const where: Prisma.route_sheetWhereInput = {
      driver_id: driverId,
      is_active: true,
      OR: [{ delivery_date: deliveryDate }],
    };
    if (date === today) {
      where.OR!.push({
        delivery_date: { lt: deliveryDate },
        execution_status: { in: OPEN_EXECUTION_STATUSES },
      });
    }

    const rows = await this.prisma.route_sheet.findMany({
      where,
      include: SUMMARY_INCLUDE,
      orderBy: [{ delivery_date: 'asc' }, { route_sheet_id: 'asc' }],
    });
    return rows.map((row) => this.toSummary(row));
  }

  async findOneForDriver(
    driverId: number,
    routeSheetId: number,
  ): Promise<DriverRouteSheetDetailDto> {
    const row = await this.prisma.route_sheet.findFirst({
      where: { route_sheet_id: routeSheetId, driver_id: driverId, is_active: true },
      include: DETAIL_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(`Hoja de ruta ${routeSheetId} no encontrada`);
    }
    return this.toDetail(row);
  }

  async start(
    driverId: number,
    routeSheetId: number,
  ): Promise<DriverRouteSheetDetailDto> {
    const sheet = await this.findOwnedOrThrow(driverId, routeSheetId);
    this.assertStatus(sheet.execution_status, RouteSheetExecutionStatus.PLANNED, 'iniciar');

    if (formatBAYMD(sheet.delivery_date) > nowBAYMD()) {
      throw new BadRequestException(
        'No se puede iniciar una hoja de ruta de una fecha futura',
      );
    }
    await this.assertNoOtherInProgress(driverId, routeSheetId);

    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, routeSheetId, RouteSheetExecutionStatus.PLANNED, {
        execution_status: RouteSheetExecutionStatus.IN_PROGRESS,
        started_at: new Date(),
      });
    });
    return this.findOneForDriver(driverId, routeSheetId);
  }

  async pause(
    driverId: number,
    routeSheetId: number,
    dto: PauseRouteSheetDto,
  ): Promise<DriverRouteSheetDetailDto> {
    const sheet = await this.findOwnedOrThrow(driverId, routeSheetId);
    this.assertStatus(sheet.execution_status, RouteSheetExecutionStatus.IN_PROGRESS, 'pausar');

    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, routeSheetId, RouteSheetExecutionStatus.IN_PROGRESS, {
        execution_status: RouteSheetExecutionStatus.PAUSED,
      });
      await tx.route_sheet_pause.create({
        data: {
          route_sheet_id: routeSheetId,
          reason: dto.reason,
          notes: dto.notes?.trim() || null,
          paused_by: driverId,
        },
      });
    });
    return this.findOneForDriver(driverId, routeSheetId);
  }

  async resume(
    driverId: number,
    routeSheetId: number,
  ): Promise<DriverRouteSheetDetailDto> {
    const sheet = await this.findOwnedOrThrow(driverId, routeSheetId);
    this.assertStatus(sheet.execution_status, RouteSheetExecutionStatus.PAUSED, 'reanudar');
    await this.assertNoOtherInProgress(driverId, routeSheetId);

    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, routeSheetId, RouteSheetExecutionStatus.PAUSED, {
        execution_status: RouteSheetExecutionStatus.IN_PROGRESS,
      });
      await tx.route_sheet_pause.updateMany({
        where: { route_sheet_id: routeSheetId, resumed_at: null },
        data: { resumed_at: new Date(), resumed_by: driverId },
      });
    });
    return this.findOneForDriver(driverId, routeSheetId);
  }

  private async findOwnedOrThrow(driverId: number, routeSheetId: number) {
    const sheet = await this.prisma.route_sheet.findFirst({
      where: { route_sheet_id: routeSheetId, driver_id: driverId, is_active: true },
      select: { route_sheet_id: true, execution_status: true, delivery_date: true },
    });
    if (!sheet) {
      throw new NotFoundException(`Hoja de ruta ${routeSheetId} no encontrada`);
    }
    return sheet;
  }

  private assertStatus(
    current: RouteSheetExecutionStatus,
    expected: RouteSheetExecutionStatus,
    action: string,
  ) {
    if (current !== expected) {
      throw new ConflictException(
        `No se puede ${action} la hoja de ruta en estado ${current}`,
      );
    }
  }

  private async assertNoOtherInProgress(driverId: number, routeSheetId: number) {
    const other = await this.prisma.route_sheet.findFirst({
      where: {
        driver_id: driverId,
        is_active: true,
        execution_status: RouteSheetExecutionStatus.IN_PROGRESS,
        route_sheet_id: { not: routeSheetId },
      },
      select: { route_sheet_id: true },
    });
    if (other) {
      throw new ConflictException(
        `Ya tenés la hoja de ruta ${other.route_sheet_id} en curso. Pausala o cerrala antes de continuar con otra.`,
      );
    }
  }

  /** Cambia el estado solo si sigue en `from`, para no pisar cambios concurrentes. */
  private async transition(
    tx: Prisma.TransactionClient,
    routeSheetId: number,
    from: RouteSheetExecutionStatus,
    data: Prisma.route_sheetUpdateManyMutationInput,
  ) {
    const result = await tx.route_sheet.updateMany({
      where: { route_sheet_id: routeSheetId, execution_status: from },
      data,
    });
    if (result.count !== 1) {
      throw new ConflictException(
        'La hoja de ruta cambió de estado mientras se procesaba la solicitud. Actualizá e intentá de nuevo.',
      );
    }
  }

  private parseDate(date: string): Date {
    try {
      return parseUTCYMD(date);
    } catch {
      throw new BadRequestException('Fecha inválida. Use YYYY-MM-DD');
    }
  }

  private toSummary(row: SummaryRow | DetailRow): DriverRouteSheetSummaryDto {
    const statuses = row.route_sheet_detail.map((d) => d.delivery_status);
    const pause = row.route_sheet_pause[0];
    return {
      route_sheet_id: row.route_sheet_id,
      delivery_date: formatBAYMD(row.delivery_date),
      execution_status: row.execution_status,
      started_at: row.started_at ? formatBATimestampISO(row.started_at) : null,
      scheduled_start_time: this.earliestStartTime(
        row.route_sheet_detail.map((d) => d.delivery_time),
      ),
      closed_at: row.closed_at ? formatBATimestampISO(row.closed_at) : null,
      route_notes: row.route_notes ?? null,
      vehicle: row.vehicle,
      totals: {
        total: statuses.length,
        pending: statuses.filter((s) => !RESOLVED_DELIVERY_STATUSES.has(s)).length,
        delivered: statuses.filter((s) => s === DeliveryStatus.DELIVERED).length,
        not_delivered: statuses.filter((s) => NOT_DELIVERED_STATUSES.has(s)).length,
      },
      active_pause: pause ? this.toPause(pause) : null,
    };
  }

  private toDetail(row: DetailRow): DriverRouteSheetDetailDto {
    const { currentIndex, resolved } = computeDeliveryLocks(
      row.route_sheet_detail.map((d) => d.delivery_status),
      row.execution_status,
    );

    const deliveries: DriverRouteSheetDeliveryDto[] = row.route_sheet_detail.map(
      (detail, index) => {
        const stop = resolveStop(detail);
        return {
          route_sheet_detail_id: detail.route_sheet_detail_id,
          position: index + 1,
          sequence_number: detail.sequence_number ?? null,
          delivery_status: detail.delivery_status,
          is_resolved: resolved[index],
          is_current: index === currentIndex,
          is_locked: !resolved[index] && index !== currentIndex,
          delivery_time: detail.delivery_time ?? null,
          stop_type: stop.stop_type,
          reference_id: stop.reference_id,
          order_id: stop.order_id,
          total_amount: stop.total_amount?.toFixed(2) ?? null,
          paid_amount: stop.paid_amount?.toFixed(2) ?? null,
          customer: stop.customer
            ? this.toCustomer(stop.customer, stop.delivery_address)
            : null,
        };
      },
    );

    return {
      ...this.toSummary(row),
      current_detail_id:
        currentIndex === null ? null : deliveries[currentIndex].route_sheet_detail_id,
      can_close:
        row.execution_status === RouteSheetExecutionStatus.IN_PROGRESS &&
        resolved.every(Boolean),
      deliveries,
    };
  }

  private toCustomer(
    customer: CustomerRow,
    deliveryAddress: string | null,
  ): DriverDeliveryCustomerDto {
    return {
      person_id: customer.person_id,
      name: customer.name ?? null,
      alias: customer.alias ?? null,
      address: deliveryAddress || customer.address || null,
      phone: customer.phone,
      location: null,
    };
  }

  private toPause(pause: {
    reason: DriverRouteSheetPauseDto['reason'];
    notes: string | null;
    paused_at: Date;
  }): DriverRouteSheetPauseDto {
    return {
      reason: pause.reason,
      notes: pause.notes ?? null,
      paused_at: formatBATimestampISO(pause.paused_at),
    };
  }

  /** Primer "HH:MM" de las franjas de entrega (ej. "08:00-10:00" → "08:00"). */
  private earliestStartTime(times: (string | null)[]): string | null {
    const starts = times
      .map((t) => /(\d{1,2}):(\d{2})/.exec(t ?? ''))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => `${m[1].padStart(2, '0')}:${m[2]}`)
      .sort();
    return starts[0] ?? null;
  }
}
