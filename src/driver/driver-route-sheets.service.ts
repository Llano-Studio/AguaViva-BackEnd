import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma, RouteSheetExecutionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryStatus } from '../common/constants/enums';
import {
  DELIVERY_SEQUENCE_ORDER_BY,
  OPEN_EXECUTION_STATUSES,
  RESOLVED_DELIVERY_STATUSES,
  computeDeliveryLocks,
  isCurrentDelivery,
} from '../route-sheet/delivery-locks';
import {
  formatBATimestampISO,
  formatBAYMD,
  nowBAYMD,
  parseUTCYMD,
} from '../common/utils/date.utils';
import {
  DriverDeliveryAction,
  DriverDeliveryCustomerDto,
  DriverDeliveryDetailCustomerDto,
  DriverDeliveryDetailDto,
  DriverDeliveryItemDto,
  DriverDeliveryOrderDto,
  DriverDeliveryPaymentDto,
  DriverRouteSheetDeliveryDto,
  DriverRouteSheetDetailDto,
  DriverRouteSheetPauseDto,
  DriverRouteSheetSummaryDto,
  DriverStopType,
  FilterDriverRouteSheetsDto,
  PauseRouteSheetDto,
} from './dto';

const NOT_DELIVERED_STATUSES: ReadonlySet<string> = new Set([
  DeliveryStatus.FAILED,
  DeliveryStatus.SKIPPED,
]);

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

const DETAIL_CUSTOMER_SELECT = {
  ...CUSTOMER_SELECT,
  tax_id: true,
  notes: true,
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
    orderBy: DELIVERY_SEQUENCE_ORDER_BY,
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

const DETAIL_ORDER_SELECT = {
  order_id: true,
  order_type: true,
  status: true,
  payment_status: true,
  order_date: true,
  total_amount: true,
  paid_amount: true,
  notes: true,
  customer: { select: DETAIL_CUSTOMER_SELECT },
  order_item: {
    select: {
      order_item_id: true,
      quantity: true,
      unit_price: true,
      subtotal: true,
      delivered_quantity: true,
      returned_quantity: true,
      product: { select: { product_id: true, description: true } },
    },
  },
} satisfies Prisma.order_headerSelect;

const DELIVERY_DETAIL_INCLUDE = {
  order_header: { select: DETAIL_ORDER_SELECT },
  one_off_purchase: {
    select: {
      purchase_id: true,
      total_amount: true,
      paid_amount: true,
      delivery_address: true,
      person: { select: DETAIL_CUSTOMER_SELECT },
    },
  },
  one_off_purchase_header: {
    select: {
      purchase_header_id: true,
      total_amount: true,
      paid_amount: true,
      delivery_address: true,
      person: { select: DETAIL_CUSTOMER_SELECT },
    },
  },
  cancellation_order: {
    select: {
      cancellation_order_id: true,
      customer_subscription: {
        select: { person: { select: DETAIL_CUSTOMER_SELECT } },
      },
    },
  },
  cycle_payment: {
    select: {
      payment_id: true,
      subscription_cycle: {
        select: {
          total_amount: true,
          paid_amount: true,
          customer_subscription: {
            select: { person: { select: DETAIL_CUSTOMER_SELECT } },
          },
        },
      },
    },
  },
} satisfies Prisma.route_sheet_detailInclude;

const PREVIOUS_PAYMENT_SELECT = {
  transaction_id: true,
  transaction_date: true,
  transaction_amount: true,
  document_number: true,
  receipt_number: true,
  payment_method: { select: { code: true } },
} satisfies Prisma.payment_transactionSelect;

type SummaryRow = Prisma.route_sheetGetPayload<{
  include: typeof SUMMARY_INCLUDE;
}>;
type DetailRow = Prisma.route_sheetGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;
type CustomerRow = Prisma.personGetPayload<{ select: typeof CUSTOMER_SELECT }>;
type DetailCustomerRow = Prisma.personGetPayload<{
  select: typeof DETAIL_CUSTOMER_SELECT;
}>;
type DetailItemRow = DetailRow['route_sheet_detail'][number];
type DeliveryDetailRow = Prisma.route_sheet_detailGetPayload<{
  include: typeof DELIVERY_DETAIL_INCLUDE;
}>;
type PreviousPaymentRow = Prisma.payment_transactionGetPayload<{
  select: typeof PREVIOUS_PAYMENT_SELECT;
}>;

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

  /**
   * Detalle de una parada para el chofer: cliente, contacto, productos con
   * precios, deuda y pagos previos. Solo accesible si la hoja es del chofer.
   */
  async findDeliveryForDriver(
    driverId: number,
    routeSheetId: number,
    detailId: number,
  ): Promise<DriverDeliveryDetailDto> {
    const sheet = await this.prisma.route_sheet.findFirst({
      where: {
        route_sheet_id: routeSheetId,
        driver_id: driverId,
        is_active: true,
      },
      select: { route_sheet_id: true, execution_status: true },
    });
    if (!sheet) {
      throw new NotFoundException(`Hoja de ruta ${routeSheetId} no encontrada`);
    }

    const [detail, siblings] = await Promise.all([
      this.prisma.route_sheet_detail.findFirst({
        where: {
          route_sheet_detail_id: detailId,
          route_sheet_id: routeSheetId,
        },
        include: DELIVERY_DETAIL_INCLUDE,
      }),
      this.prisma.route_sheet_detail.findMany({
        where: { route_sheet_id: routeSheetId },
        select: { route_sheet_detail_id: true, delivery_status: true },
        orderBy: DELIVERY_SEQUENCE_ORDER_BY,
      }),
    ]);

    if (!detail) {
      throw new NotFoundException(`Parada ${detailId} no encontrada`);
    }

    const previousPayments = detail.order_id
      ? await this.prisma.payment_transaction.findMany({
          where: { order_id: detail.order_id, is_active: true },
          orderBy: [{ transaction_date: 'desc' }, { transaction_id: 'desc' }],
          select: PREVIOUS_PAYMENT_SELECT,
        })
      : [];

    return this.toDeliveryDetail(detail, sheet, siblings, previousPayments);
  }

  private toDeliveryDetail(
    detail: DeliveryDetailRow,
    sheet: {
      route_sheet_id: number;
      execution_status: RouteSheetExecutionStatus;
    },
    siblings: { route_sheet_detail_id: number; delivery_status: string }[],
    previousPayments: PreviousPaymentRow[],
  ): DriverDeliveryDetailDto {
    const executionStatus = sheet.execution_status;
    const stop = resolveStop(detail);
    const isResolved = RESOLVED_DELIVERY_STATUSES.has(detail.delivery_status);
    const isCurrent = isCurrentDelivery(
      siblings,
      detail.route_sheet_detail_id,
      executionStatus,
    );

    return {
      route_sheet_id: sheet.route_sheet_id,
      route_sheet_detail_id: detail.route_sheet_detail_id,
      execution_status: executionStatus,
      delivery_status: detail.delivery_status,
      is_current: isCurrent,
      is_resolved: isResolved,
      stop_type: stop.stop_type,
      delivery_time: detail.delivery_time ?? null,
      version: this.buildVersion(detail),
      allowed_actions: this.allowedActions(
        executionStatus,
        isCurrent,
        detail.delivery_status as DeliveryStatus,
      ),
      customer: this.toDetailCustomer(stop.customer, stop.delivery_address),
      order: detail.order_header
        ? this.toDetailOrder(detail.order_header)
        : null,
      previous_payments: previousPayments.map(
        (payment): DriverDeliveryPaymentDto => ({
          transaction_id: payment.transaction_id,
          transaction_date: formatBATimestampISO(payment.transaction_date),
          amount: payment.transaction_amount.toFixed(2),
          payment_method: payment.payment_method.code,
          document_number: payment.document_number ?? null,
          receipt_number: payment.receipt_number ?? null,
        }),
      ),
      credits: [],
    };
  }

  private toDetailCustomer(
    customer: CustomerRow | null,
    deliveryAddress: string | null,
  ): DriverDeliveryDetailCustomerDto {
    if (!customer) {
      return {
        person_id: 0,
        name: null,
        alias: null,
        address: null,
        phone: '',
        location: null,
        tax_id: null,
        notes: null,
      };
    }
    // El include del detalle trae tax_id y notes además de los campos básicos.
    const detailed = customer as DetailCustomerRow;
    return {
      person_id: detailed.person_id,
      name: detailed.name ?? null,
      alias: detailed.alias ?? null,
      address: deliveryAddress || detailed.address || null,
      phone: detailed.phone,
      location: null,
      tax_id: detailed.tax_id ?? null,
      notes: detailed.notes ?? null,
    };
  }

  private toDetailOrder(
    order: NonNullable<DeliveryDetailRow['order_header']>,
  ): DriverDeliveryOrderDto {
    const total = Number(order.total_amount);
    const paid = Number(order.paid_amount);
    const debt = Math.max(total - paid, 0);

    const items: DriverDeliveryItemDto[] = order.order_item.map((item) => ({
      order_item_id: item.order_item_id,
      product_id: item.product.product_id,
      product_description: item.product.description,
      quantity: item.quantity,
      delivered_quantity: item.delivered_quantity ?? 0,
      returned_quantity: item.returned_quantity ?? 0,
      unit_price: item.unit_price.toFixed(2),
      subtotal: item.subtotal.toFixed(2),
    }));

    return {
      order_id: order.order_id,
      order_type: order.order_type,
      status: order.status,
      payment_status: order.payment_status,
      order_date: formatBATimestampISO(order.order_date),
      total_amount: total.toFixed(2),
      paid_amount: paid.toFixed(2),
      debt_amount: debt.toFixed(2),
      items,
      notes: order.notes ?? null,
    };
  }

  /**
   * Acciones habilitadas: solo sobre la parada actual y con la hoja en curso.
   * VISITED permite entregar pero no volver a visitar.
   */
  private allowedActions(
    executionStatus: RouteSheetExecutionStatus,
    isCurrent: boolean,
    deliveryStatus: DeliveryStatus,
  ): DriverDeliveryAction[] {
    if (
      executionStatus !== RouteSheetExecutionStatus.IN_PROGRESS ||
      !isCurrent
    ) {
      return [];
    }
    if (deliveryStatus === DeliveryStatus.PENDING) {
      return [
        DriverDeliveryAction.VISIT,
        DriverDeliveryAction.DELIVER,
        DriverDeliveryAction.SKIP,
      ];
    }
    if (deliveryStatus === DeliveryStatus.VISITED) {
      return [DriverDeliveryAction.DELIVER, DriverDeliveryAction.SKIP];
    }
    return [];
  }

  /**
   * Hash estable del estado mutable de la parada. Sirve para que el front
   * detecte que trabajó con datos obsoletos.
   */
  private buildVersion(detail: DeliveryDetailRow): string {
    const order = detail.order_header;
    const payload = [
      detail.route_sheet_detail_id,
      detail.delivery_status,
      detail.comments ?? '',
      detail.actual_arrival_time?.toISOString() ?? '',
      order?.status ?? '',
      order?.paid_amount?.toString() ?? '',
    ].join('|');
    return createHash('sha1').update(payload).digest('hex').slice(0, 16);
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

    await this.runSheetTransition(() =>
      this.prisma.$transaction(async (tx) => {
        await this.transition(tx, routeSheetId, RouteSheetExecutionStatus.PLANNED, {
          execution_status: RouteSheetExecutionStatus.IN_PROGRESS,
          started_at: new Date(),
        });
      }),
    );
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

    await this.runSheetTransition(() =>
      this.prisma.$transaction(async (tx) => {
        await this.transition(tx, routeSheetId, RouteSheetExecutionStatus.PAUSED, {
          execution_status: RouteSheetExecutionStatus.IN_PROGRESS,
        });
        await tx.route_sheet_pause.updateMany({
          where: { route_sheet_id: routeSheetId, resumed_at: null },
          data: { resumed_at: new Date(), resumed_by: driverId },
        });
      }),
    );
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

  /**
   * Traduce la violación del índice único parcial (una hoja en curso por chofer)
   * al mismo 409 que devuelve la verificación previa, para cubrir la carrera
   * entre dos solicitudes simultáneas.
   */
  private async runSheetTransition<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya tenés otra hoja de ruta en curso. Pausala o cerrala antes de continuar con otra.',
        );
      }
      throw error;
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
