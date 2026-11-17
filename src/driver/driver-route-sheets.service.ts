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
  AddDeliveryItemDto,
  AddDeliveryItemsDto,
  DriverDeliveryAction,
  DriverDeliveryCustomerDto,
  DriverDeliveryDetailCustomerDto,
  DriverDeliveryDetailDto,
  DriverDeliveryItemDto,
  DriverDeliveryOrderDto,
  DriverDeliveryPaymentDto,
  DriverInventoryItemDto,
  DriverRouteSheetDeliveryDto,
  DriverRouteSheetDetailDto,
  DriverRouteSheetInventoryDto,
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

/** Producto a agregar a una parada, ya con el precio resuelto por el servidor. */
interface PricedStopItem {
  product_id: number;
  quantity: number;
  unit_price: Prisma.Decimal;
  price_list_id: number | null;
}

/**
 * Hash estable del estado mutable de la parada. Sirve para que el front
 * detecte que trabajó con datos obsoletos y para validar la versión que envían
 * las operaciones del chofer (agregar ítems, cobrar).
 */
export function buildDeliveryVersion(detail: {
  route_sheet_detail_id: number;
  delivery_status: string;
  comments: string | null;
  actual_arrival_time: Date | null;
  order_header: { status: string; paid_amount: Prisma.Decimal } | null;
}): string {
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
  private buildVersion(detail: {
    route_sheet_detail_id: number;
    delivery_status: string;
    comments: string | null;
    actual_arrival_time: Date | null;
    order_header: { status: string; paid_amount: Prisma.Decimal } | null;
  }): string {
    return buildDeliveryVersion(detail);
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

  /**
   * Inventario del camión para la hoja del chofer. Expone lo cargado, lo que
   * queda y lo todavía ofrecible: lo que hay menos lo comprometido con las
   * paradas sin resolver.
   */
  async getInventoryForDriver(
    driverId: number,
    routeSheetId: number,
  ): Promise<DriverRouteSheetInventoryDto> {
    const sheet = await this.prisma.route_sheet.findFirst({
      where: { route_sheet_id: routeSheetId, driver_id: driverId, is_active: true },
      select: { route_sheet_id: true },
    });
    if (!sheet) {
      throw new NotFoundException(`Hoja de ruta ${routeSheetId} no encontrada`);
    }

    const [inventory, committed] = await Promise.all([
      this.prisma.vehicle_route_inventory.findMany({
        where: { route_sheet_id: routeSheetId },
        include: {
          product: { select: { product_id: true, description: true } },
        },
        orderBy: { product_id: 'asc' },
      }),
      this.committedQuantitiesByProduct(routeSheetId),
    ]);

    const items: DriverInventoryItemDto[] = inventory.map((item) => {
      const required = committed.get(item.product_id) ?? 0;
      return {
        product_id: item.product.product_id,
        description: item.product.description,
        initial_quantity: item.initial_quantity,
        current_quantity: item.current_quantity,
        returned_quantity: item.returned_quantity,
        available_quantity: Math.max(item.current_quantity - required, 0),
      };
    });

    return new DriverRouteSheetInventoryDto({
      route_sheet_id: routeSheetId,
      items,
    });
  }

  /**
   * Expande la parada actual con productos que el cliente pide en el momento.
   *
   * El chofer sólo indica producto y cantidad: el precio sale del catálogo del
   * servidor y la disponibilidad del inventario del camión. Se rechaza modificar
   * una parada resuelta, una hoja fuera de curso o un pedido ya cobrado, para no
   * cambiar un importe que el cliente aceptó.
   */
  async addItemsToDelivery(
    driverId: number,
    detailId: number,
    dto: AddDeliveryItemsDto,
  ): Promise<DriverDeliveryDetailDto> {
    const detail = await this.prisma.route_sheet_detail.findUnique({
      where: { route_sheet_detail_id: detailId },
      include: {
        route_sheet: {
          select: {
            route_sheet_id: true,
            driver_id: true,
            is_active: true,
            execution_status: true,
          },
        },
        order_header: {
          select: {
            order_id: true,
            status: true,
            paid_amount: true,
            contract_id: true,
          },
        },
        one_off_purchase: {
          select: {
            purchase_id: true,
            product_id: true,
            quantity: true,
            paid_amount: true,
            price_list_id: true,
          },
        },
        one_off_purchase_header: {
          select: {
            purchase_header_id: true,
            paid_amount: true,
            price_list_id: true,
          },
        },
      },
    });

    const sheet = detail?.route_sheet;
    if (!detail || !sheet || !sheet.is_active || sheet.driver_id !== driverId) {
      throw new NotFoundException(`Parada ${detailId} no encontrada`);
    }
    if (sheet.execution_status !== RouteSheetExecutionStatus.IN_PROGRESS) {
      throw new ConflictException('La hoja de ruta no está en curso');
    }
    if (RESOLVED_DELIVERY_STATUSES.has(detail.delivery_status)) {
      throw new ConflictException('La parada ya está resuelta');
    }

    const siblings = await this.prisma.route_sheet_detail.findMany({
      where: { route_sheet_id: sheet.route_sheet_id },
      select: { route_sheet_detail_id: true, delivery_status: true },
      orderBy: DELIVERY_SEQUENCE_ORDER_BY,
    });
    if (!isCurrentDelivery(siblings, detailId, sheet.execution_status)) {
      throw new ConflictException(
        'Solo se pueden agregar productos a la parada actual',
      );
    }

    if (dto.version && dto.version !== this.buildVersion(detail)) {
      throw new ConflictException(
        'La parada cambió desde la última consulta. Actualizá e intentá de nuevo.',
      );
    }

    const order = detail.order_header;
    const oneOff = detail.one_off_purchase;
    const oneOffHeader = detail.one_off_purchase_header;
    if (!order && !oneOff && !oneOffHeader) {
      throw new ConflictException('Esta parada no admite agregar productos');
    }
    const paidAmount = order
      ? Number(order.paid_amount)
      : Number((oneOffHeader ?? oneOff)?.paid_amount ?? 0);
    if (paidAmount > 0) {
      throw new ConflictException(
        'La parada ya tiene pagos aplicados; no se puede cambiar el importe acordado',
      );
    }

    const requested = this.normalizeItems(dto.items);
    const priceListId = await this.resolvePriceListId(detail);
    const priced = await this.priceItems(requested, priceListId);

    await this.prisma.$transaction(async (tx) => {
      // La disponibilidad se valida dentro de la transacción para que el chequeo
      // y la escritura no queden separados por una ventana de carrera.
      await this.assertStopAvailability(sheet.route_sheet_id, priced, tx);
      if (order) {
        await this.applyOrderItems(tx, order.order_id, priced);
      } else if (oneOff) {
        await this.applyOneOffPurchase(tx, oneOff, priced);
      } else if (oneOffHeader) {
        await this.applyOneOffPurchaseHeader(
          tx,
          oneOffHeader.purchase_header_id,
          priced,
        );
      }
    });

    return this.findDeliveryForDriver(driverId, sheet.route_sheet_id, detailId);
  }

  /**
   * Suma, por producto, las unidades ya comprometidas con las paradas sin
   * resolver de la hoja: pedidos, compras puntuales y compras puntuales con
   * varias líneas. Las cobranzas y cancelaciones no comprometen stock.
   */
  private async committedQuantitiesByProduct(
    routeSheetId: number,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<Map<number, number>> {
    const details = await db.route_sheet_detail.findMany({
      where: {
        route_sheet_id: routeSheetId,
        delivery_status: { notIn: [...RESOLVED_DELIVERY_STATUSES] },
      },
      select: {
        order_header: {
          select: {
            order_item: {
              select: {
                product_id: true,
                quantity: true,
                delivered_quantity: true,
              },
            },
          },
        },
        one_off_purchase: {
          select: {
            product_id: true,
            quantity: true,
            delivered_quantity: true,
          },
        },
        one_off_purchase_header: {
          select: {
            purchase_items: { select: { product_id: true, quantity: true } },
          },
        },
      },
    });

    const committed = new Map<number, number>();
    const add = (productId: number, quantity: number) => {
      if (quantity <= 0) return;
      committed.set(productId, (committed.get(productId) ?? 0) + quantity);
    };

    for (const detail of details) {
      for (const item of detail.order_header?.order_item ?? []) {
        add(item.product_id, item.quantity - (item.delivered_quantity ?? 0));
      }
      const purchase = detail.one_off_purchase;
      if (purchase) {
        add(
          purchase.product_id,
          purchase.quantity - (purchase.delivered_quantity ?? 0),
        );
      }
      for (const item of detail.one_off_purchase_header?.purchase_items ?? []) {
        add(item.product_id, item.quantity);
      }
    }
    return committed;
  }

  /** Une líneas repetidas del mismo producto y devuelve un orden estable. */
  private normalizeItems(items: AddDeliveryItemDto[]): AddDeliveryItemDto[] {
    const merged = new Map<number, number>();
    for (const item of items) {
      merged.set(
        item.product_id,
        (merged.get(item.product_id) ?? 0) + item.quantity,
      );
    }
    return [...merged.entries()]
      .sort(([left], [right]) => left - right)
      .map(([product_id, quantity]) => ({ product_id, quantity }));
  }

  /** Lista de precios aplicable: la del contrato del pedido o la de la venta puntual. */
  private async resolvePriceListId(detail: {
    order_header: { contract_id: number | null } | null;
    one_off_purchase: { price_list_id: number | null } | null;
    one_off_purchase_header: { price_list_id: number | null } | null;
  }): Promise<number | null> {
    const contractId = detail.order_header?.contract_id;
    if (contractId) {
      const contract = await this.prisma.client_contract.findUnique({
        where: { contract_id: contractId },
        select: { price_list_id: true },
      });
      if (contract) return contract.price_list_id;
    }
    return (
      detail.one_off_purchase_header?.price_list_id ??
      detail.one_off_purchase?.price_list_id ??
      null
    );
  }

  /**
   * Resuelve el precio de cada producto en el servidor. El cliente nunca envía
   * precios: la lista de precios manda y, si no tiene el producto, se usa el
   * precio de catálogo del producto.
   */
  private async priceItems(
    requested: AddDeliveryItemDto[],
    priceListId: number | null,
  ): Promise<PricedStopItem[]> {
    const productIds = requested.map((item) => item.product_id);
    const products = await this.prisma.product.findMany({
      where: { product_id: { in: productIds }, is_active: true },
      select: { product_id: true, price: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException(
        'Alguno de los productos no existe o está inactivo',
      );
    }
    const catalogPrice = new Map(
      products.map((product) => [product.product_id, product.price]),
    );

    const listPrices = priceListId
      ? await this.prisma.price_list_item.findMany({
          where: { price_list_id: priceListId, product_id: { in: productIds } },
          select: { product_id: true, unit_price: true },
        })
      : [];
    const listPrice = new Map(
      listPrices.map((item) => [item.product_id, item.unit_price]),
    );

    return requested.map((item) => {
      const fromList = listPrice.get(item.product_id);
      const unit_price = fromList ?? catalogPrice.get(item.product_id);
      if (!unit_price) {
        throw new BadRequestException(
          `No se pudo determinar el precio del producto ${item.product_id}`,
        );
      }
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price,
        price_list_id: fromList ? priceListId : null,
      };
    });
  }

  /**
   * Verifica que el camión pueda cubrir lo pedido sin descubrir las paradas
   * pendientes: disponible = lo que hay en el camión menos lo ya comprometido.
   */
  private async assertStopAvailability(
    routeSheetId: number,
    priced: PricedStopItem[],
    db: Prisma.TransactionClient,
  ): Promise<void> {
    const [inventory, committed] = await Promise.all([
      db.vehicle_route_inventory.findMany({
        where: { route_sheet_id: routeSheetId },
        select: { product_id: true, current_quantity: true },
      }),
      this.committedQuantitiesByProduct(routeSheetId, db),
    ]);
    const stock = new Map(
      inventory.map((item) => [item.product_id, item.current_quantity]),
    );

    for (const item of priced) {
      if (!stock.has(item.product_id)) {
        throw new ConflictException(
          `El producto ${item.product_id} no está cargado en el camión`,
        );
      }
      const available =
        (stock.get(item.product_id) ?? 0) -
        (committed.get(item.product_id) ?? 0);
      if (item.quantity > available) {
        throw new ConflictException(
          `Stock insuficiente del producto ${item.product_id}: disponible ${Math.max(available, 0)}, pedido ${item.quantity}`,
        );
      }
    }
  }

  /**
   * Suma las líneas nuevas al pedido y recalcula el total. Si el producto ya
   * estaba en el pedido se amplía esa línea con el precio del catálogo actual.
   */
  private async applyOrderItems(
    tx: Prisma.TransactionClient,
    orderId: number,
    priced: PricedStopItem[],
  ): Promise<void> {
    for (const item of priced) {
      const existing = await tx.order_item.findFirst({
        where: { order_id: orderId, product_id: item.product_id },
        select: { order_item_id: true, quantity: true },
      });
      if (existing) {
        const quantity = existing.quantity + item.quantity;
        await tx.order_item.update({
          where: { order_item_id: existing.order_item_id },
          data: {
            quantity,
            unit_price: item.unit_price,
            subtotal: item.unit_price.mul(quantity),
            price_list_id: item.price_list_id,
          },
        });
      } else {
        await tx.order_item.create({
          data: {
            order_id: orderId,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.unit_price.mul(item.quantity),
            price_list_id: item.price_list_id,
          },
        });
      }
    }
    await this.recalculateOrderTotal(tx, orderId);
  }

  private async recalculateOrderTotal(
    tx: Prisma.TransactionClient,
    orderId: number,
  ): Promise<void> {
    const items = await tx.order_item.findMany({
      where: { order_id: orderId },
      select: { subtotal: true },
    });
    const total = items.reduce(
      (acc, item) => acc.add(item.subtotal),
      new Prisma.Decimal(0),
    );
    await tx.order_header.update({
      where: { order_id: orderId },
      data: { total_amount: total },
    });
  }

  /**
   * Amplía una compra puntual de una sola línea. Solo admite el producto ya
   * cargado: el modelo no representa varios productos en esta tabla.
   */
  private async applyOneOffPurchase(
    tx: Prisma.TransactionClient,
    oneOff: {
      purchase_id: number;
      product_id: number;
      quantity: number;
      price_list_id: number | null;
    },
    priced: PricedStopItem[],
  ): Promise<void> {
    const item = priced[0];
    if (priced.length !== 1 || item.product_id !== oneOff.product_id) {
      throw new ConflictException(
        'Esta compra puntual solo admite ampliar el producto que ya tiene cargado',
      );
    }
    const quantity = oneOff.quantity + item.quantity;
    await tx.one_off_purchase.update({
      where: { purchase_id: oneOff.purchase_id },
      data: {
        quantity,
        total_amount: item.unit_price.mul(quantity),
        price_list_id: item.price_list_id ?? oneOff.price_list_id,
      },
    });
  }

  /**
   * Suma líneas a una compra puntual con encabezado, creándolas si el producto
   * todavía no estaba, y recalcula el total del encabezado.
   */
  private async applyOneOffPurchaseHeader(
    tx: Prisma.TransactionClient,
    purchaseHeaderId: number,
    priced: PricedStopItem[],
  ): Promise<void> {
    for (const item of priced) {
      const existing = await tx.one_off_purchase_item.findFirst({
        where: {
          purchase_header_id: purchaseHeaderId,
          product_id: item.product_id,
        },
        select: { purchase_item_id: true, quantity: true },
      });
      if (existing) {
        const quantity = existing.quantity + item.quantity;
        await tx.one_off_purchase_item.update({
          where: { purchase_item_id: existing.purchase_item_id },
          data: {
            quantity,
            unit_price: item.unit_price,
            subtotal: item.unit_price.mul(quantity),
            price_list_id: item.price_list_id,
          },
        });
      } else {
        await tx.one_off_purchase_item.create({
          data: {
            purchase_header_id: purchaseHeaderId,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.unit_price.mul(item.quantity),
            price_list_id: item.price_list_id,
          },
        });
      }
    }

    const items = await tx.one_off_purchase_item.findMany({
      where: { purchase_header_id: purchaseHeaderId },
      select: { subtotal: true },
    });
    const total = items.reduce(
      (acc, item) => acc.add(item.subtotal),
      new Prisma.Decimal(0),
    );
    await tx.one_off_purchase_header.update({
      where: { purchase_header_id: purchaseHeaderId },
      data: { total_amount: total },
    });
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
