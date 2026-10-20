import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, RouteSheetExecutionStatus } from '@prisma/client';
import * as fs from 'fs-extra';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryStatus } from '../common/constants/enums';
import { MobileInventoryService } from '../common/services/mobile-inventory.service';
import {
  DELIVERY_SEQUENCE_ORDER_BY,
  RESOLVED_DELIVERY_STATUSES,
  isCurrentDelivery,
} from '../route-sheet/delivery-locks';
import { formatBATimestampISO } from '../common/utils/date.utils';
import { buildImageUrl } from '../common/utils/file-upload.util';
import {
  DriverRouteSheetsService,
  buildDeliveryVersion,
} from './driver-route-sheets.service';
import {
  ConfirmDeliveryDto,
  DriverDeliveredItemDto,
  DriverDeliveryConfirmationResultDto,
  DriverDeliveryDetailCustomerDto,
  DriverDeliveryDetailDto,
  DriverDeliveryPaymentDto,
  DriverDeliverySignatureResultDto,
  DriverDeliverySummaryDto,
  DriverDeliverySummaryItemDto,
  DriverDeliverySummaryTotalsDto,
  DriverStopType,
  RegisterDeliverySignatureDto,
  SkipDeliveryDto,
} from './dto';

/** Tipo de evidencia que cuenta como firma del receptor. */
const SIGNATURE_EVIDENCE_TYPE = 'SIGNATURE';
const DELIVERY_EVIDENCE_FOLDER = 'delivery-evidence';
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

/** Extensiones admitidas para la firma manuscrita. */
const SIGNATURE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
};

const PERSON_SELECT = {
  person_id: true,
  name: true,
  alias: true,
  address: true,
  phone: true,
  tax_id: true,
} satisfies Prisma.personSelect;

const STOP_INCLUDE = {
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
      total_amount: true,
      paid_amount: true,
      customer: { select: PERSON_SELECT },
      order_item: {
        select: {
          product_id: true,
          quantity: true,
          delivered_quantity: true,
          unit_price: true,
          subtotal: true,
          product: { select: { description: true } },
        },
      },
    },
  },
  one_off_purchase: {
    select: {
      purchase_id: true,
      product_id: true,
      quantity: true,
      delivered_quantity: true,
      total_amount: true,
      paid_amount: true,
      delivery_address: true,
      person: { select: PERSON_SELECT },
      product: { select: { description: true } },
    },
  },
  one_off_purchase_header: {
    select: {
      purchase_header_id: true,
      total_amount: true,
      paid_amount: true,
      delivery_address: true,
      person: { select: PERSON_SELECT },
      purchase_items: {
        select: {
          product_id: true,
          quantity: true,
          unit_price: true,
          subtotal: true,
          product: { select: { description: true } },
        },
      },
    },
  },
  cancellation_order: {
    select: {
      cancellation_order_id: true,
      customer_subscription: {
        select: { person: { select: PERSON_SELECT } },
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
          pending_balance: true,
          customer_subscription: {
            select: { person: { select: PERSON_SELECT } },
          },
        },
      },
    },
  },
} satisfies Prisma.route_sheet_detailInclude;

type StopRow = Prisma.route_sheet_detailGetPayload<{
  include: typeof STOP_INCLUDE;
}>;

const PREVIOUS_PAYMENT_SELECT = {
  transaction_id: true,
  transaction_date: true,
  transaction_amount: true,
  document_number: true,
  receipt_number: true,
  payment_method: { select: { code: true } },
} satisfies Prisma.payment_transactionSelect;

type PreviousPaymentRow = Prisma.payment_transactionGetPayload<{
  select: typeof PREVIOUS_PAYMENT_SELECT;
}>;

/**
 * Firma y confirmación de entrega. El resumen que el cliente firmó viaja con su
 * `version`: la confirmación es una transacción única que valida firma/versión,
 * descuenta stock (idempotente por producto), marca el detalle DELIVERED y
 * sincroniza el pedido asociado. Un reintento no vuelve a aplicar efectos.
 */
@Injectable()
export class DriverDeliveriesService {
  private readonly evidencePath = path.join(
    process.cwd(),
    'public',
    'uploads',
    DELIVERY_EVIDENCE_FOLDER,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly routeSheetsService: DriverRouteSheetsService,
    private readonly inventoryService: MobileInventoryService,
  ) {}

  /** Resumen de productos, cantidades, cobros y saldo que el cliente firma. */
  async getSummary(
    driverId: number,
    detailId: number,
  ): Promise<DriverDeliverySummaryDto> {
    const detail = await this.loadStop(driverId, detailId);
    const [signature, payments, isCurrent] = await Promise.all([
      this.findSignature(detailId),
      this.loadPreviousPayments(detail),
      this.isCurrent(detail),
    ]);

    return {
      route_sheet_id: detail.route_sheet.route_sheet_id,
      route_sheet_detail_id: detail.route_sheet_detail_id,
      stop_type: this.stopType(detail),
      delivery_status: detail.delivery_status,
      is_current: isCurrent,
      is_resolved: RESOLVED_DELIVERY_STATUSES.has(detail.delivery_status),
      version: this.version(detail),
      customer: this.buildCustomer(detail),
      items: this.buildItems(detail),
      payments: payments.map((payment) => this.toPaymentDto(payment)),
      totals: this.buildTotals(detail),
      requires_signature: true,
      signature_present: signature !== null,
      signature_missing_reason:
        signature === null ? (detail.delivery_notes ?? null) : null,
    };
  }

  /**
   * Guarda la firma del receptor vinculada a la parada. No marca la entrega como
   * entregada: eso ocurre recién en la confirmación. Ante un fallo de la base el
   * archivo recién escrito se elimina para no dejar huérfanos.
   */
  async registerSignature(
    driverId: number,
    detailId: number,
    dto: RegisterDeliverySignatureDto,
  ): Promise<DriverDeliverySignatureResultDto> {
    const detail = await this.loadStop(driverId, detailId);
    await this.assertOperable(detail);

    if (dto.version && dto.version !== this.version(detail)) {
      throw new ConflictException(
        'El resumen cambió desde la última consulta. Actualizá e intentá de nuevo.',
      );
    }

    const fileName = await this.saveSignatureFile(dto.signature, detailId);
    const recipientName = dto.received_by_name?.trim() || detail.recipient_name;

    try {
      const evidence = await this.prisma.$transaction(async (tx) => {
        const created = await tx.delivery_evidence.create({
          data: {
            route_sheet_detail_id: detailId,
            evidence_type: SIGNATURE_EVIDENCE_TYPE,
            file_path: fileName,
            created_by: driverId,
          },
          select: { evidence_id: true, created_at: true },
        });
        await tx.route_sheet_detail.update({
          where: { route_sheet_detail_id: detailId },
          data: {
            digital_signature_id: fileName,
            recipient_name: recipientName,
          },
        });
        return created;
      });

      return {
        evidence_id: evidence.evidence_id,
        route_sheet_detail_id: detailId,
        file_url: buildImageUrl(fileName, DELIVERY_EVIDENCE_FOLDER) ?? '',
        received_by_name: recipientName,
        created_at: formatBATimestampISO(evidence.created_at),
        version: this.version(detail),
      };
    } catch (error) {
      await fs
        .remove(path.join(this.evidencePath, fileName))
        .catch(() => undefined);
      throw error;
    }
  }

  /**
   * Confirma la entrega de la parada actual: valida el resumen firmado y, en una
   * sola transacción, descuenta stock, marca el detalle DELIVERED y sincroniza
   * el pedido asociado. Un reintento sobre una entrega ya confirmada no duplica
   * efectos: devuelve el estado actual.
   */
  async confirmDelivery(
    driverId: number,
    detailId: number,
    dto: ConfirmDeliveryDto,
  ): Promise<DriverDeliveryConfirmationResultDto> {
    const detail = await this.loadStop(driverId, detailId);
    const routeSheetId = detail.route_sheet.route_sheet_id;

    if (detail.delivery_status === String(DeliveryStatus.DELIVERED)) {
      const signature = await this.findSignature(detailId);
      return this.buildConfirmation(
        driverId,
        routeSheetId,
        detail,
        [],
        signature !== null,
        signature === null ? (detail.delivery_notes ?? null) : null,
        detail.order_header?.status ?? null,
        true,
      );
    }

    await this.assertOperable(detail);
    if (dto.version && dto.version !== this.version(detail)) {
      throw new ConflictException(
        'El resumen cambió desde la última consulta. Actualizá e intentá de nuevo.',
      );
    }

    const signature = await this.findSignature(detailId);
    const missingReason = signature
      ? null
      : (dto.signature_missing_reason ?? null);
    if (!signature && !missingReason) {
      throw new ConflictException(
        'Falta la firma del receptor. Si no puede firmar, indicá el motivo autorizado.',
      );
    }

    const deliveredItems = this.pendingItems(detail).filter(
      (item) => item.quantity > 0,
    );

    const applied = await this.runConfirmation(async () =>
      this.prisma.$transaction(async (tx) => {
        // Cambia el estado solo si la parada seguía sin resolver: si otra
        // confirmación se adelantó, no se aplica ningún efecto.
        const flipped = await tx.route_sheet_detail.updateMany({
          where: {
            route_sheet_detail_id: detailId,
            delivery_status: { notIn: [...RESOLVED_DELIVERY_STATUSES] },
          },
          data: {
            delivery_status: DeliveryStatus.DELIVERED,
            delivery_time: detail.delivery_time ?? this.nowHHMM(),
            actual_arrival_time: detail.actual_arrival_time ?? new Date(),
            delivery_notes: missingReason ?? detail.delivery_notes,
          },
        });
        if (flipped.count !== 1) return false;

        await this.applyStockForItems(
          tx,
          routeSheetId,
          detailId,
          deliveredItems,
        );
        await this.syncObligationStatus(tx, detail);
        return true;
      }),
    );

    return this.buildConfirmation(
      driverId,
      routeSheetId,
      detail,
      deliveredItems,
      signature !== null,
      missingReason,
      detail.order_header ? OrderStatus.DELIVERED : null,
      !applied,
    );
  }

  /**
   * Salta la parada actual con un motivo obligatorio. Registra el motivo en el
   * detalle y deja un incidente auditable para que el cierre pueda explicar cada
   * pendiente. Reprogramar o derivar al admin queda fuera de esta operación del
   * chofer. Un reintento sobre una parada ya saltada no vuelve a escribir.
   */
  async skipDelivery(
    driverId: number,
    detailId: number,
    dto: SkipDeliveryDto,
  ): Promise<DriverDeliveryDetailDto> {
    const detail = await this.loadStop(driverId, detailId);
    const routeSheetId = detail.route_sheet.route_sheet_id;

    if (detail.delivery_status === String(DeliveryStatus.SKIPPED)) {
      return this.routeSheetsService.findDeliveryForDriver(
        driverId,
        routeSheetId,
        detailId,
      );
    }

    await this.assertOperable(detail);
    if (dto.version && dto.version !== this.version(detail)) {
      throw new ConflictException(
        'La parada cambió desde la última consulta. Actualizá e intentá de nuevo.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const flipped = await tx.route_sheet_detail.updateMany({
        where: {
          route_sheet_detail_id: detailId,
          delivery_status: { notIn: [...RESOLVED_DELIVERY_STATUSES] },
        },
        data: {
          delivery_status: DeliveryStatus.SKIPPED,
          rejection_reason: dto.reason,
          comments: dto.notes?.trim() || detail.comments,
          delivery_time: detail.delivery_time ?? this.nowHHMM(),
        },
      });
      if (flipped.count !== 1) return;

      await tx.delivery_incident.create({
        data: {
          route_sheet_detail_id: detailId,
          incident_type: 'DELIVERY_SKIPPED',
          description: dto.notes?.trim() || dto.reason,
          created_by: driverId,
          status: 'OPEN',
        },
      });
    });

    return this.routeSheetsService.findDeliveryForDriver(
      driverId,
      routeSheetId,
      detailId,
    );
  }

  /** Carga la parada validando que la hoja sea del chofer. */
  private async loadStop(driverId: number, detailId: number): Promise<StopRow> {
    const detail = await this.prisma.route_sheet_detail.findUnique({
      where: { route_sheet_detail_id: detailId },
      include: STOP_INCLUDE,
    });
    const sheet = detail?.route_sheet;
    if (!detail || !sheet || !sheet.is_active || sheet.driver_id !== driverId) {
      throw new NotFoundException(`Parada ${detailId} no encontrada`);
    }
    return detail;
  }

  /** Exige hoja en curso, parada sin resolver y que sea la parada actual. */
  private async assertOperable(detail: StopRow): Promise<void> {
    if (
      detail.route_sheet.execution_status !==
      RouteSheetExecutionStatus.IN_PROGRESS
    ) {
      throw new ConflictException('La hoja de ruta no está en curso');
    }
    if (RESOLVED_DELIVERY_STATUSES.has(detail.delivery_status)) {
      throw new ConflictException('La parada ya está resuelta');
    }
    if (!(await this.isCurrent(detail))) {
      throw new ConflictException(
        'Solo se puede operar la parada actual del recorrido',
      );
    }
  }

  private async isCurrent(detail: StopRow): Promise<boolean> {
    const siblings = await this.prisma.route_sheet_detail.findMany({
      where: { route_sheet_id: detail.route_sheet.route_sheet_id },
      select: { route_sheet_detail_id: true, delivery_status: true },
      orderBy: DELIVERY_SEQUENCE_ORDER_BY,
    });
    return isCurrentDelivery(
      siblings,
      detail.route_sheet_detail_id,
      detail.route_sheet.execution_status,
    );
  }

  private async findSignature(
    detailId: number,
  ): Promise<{ evidence_id: number; file_path: string } | null> {
    return this.prisma.delivery_evidence.findFirst({
      where: {
        route_sheet_detail_id: detailId,
        evidence_type: SIGNATURE_EVIDENCE_TYPE,
      },
      orderBy: { evidence_id: 'desc' },
      select: { evidence_id: true, file_path: true },
    });
  }

  private async loadPreviousPayments(
    detail: StopRow,
  ): Promise<PreviousPaymentRow[]> {
    if (!detail.order_header) return [];
    return this.prisma.payment_transaction.findMany({
      where: { order_id: detail.order_header.order_id, is_active: true },
      orderBy: [{ transaction_date: 'desc' }, { transaction_id: 'desc' }],
      select: PREVIOUS_PAYMENT_SELECT,
    });
  }

  private toPaymentDto(payment: PreviousPaymentRow): DriverDeliveryPaymentDto {
    return {
      transaction_id: payment.transaction_id,
      transaction_date: formatBATimestampISO(payment.transaction_date),
      amount: payment.transaction_amount.toFixed(2),
      payment_method: payment.payment_method.code,
      document_number: payment.document_number ?? null,
      receipt_number: payment.receipt_number ?? null,
    };
  }

  private stopType(detail: StopRow): DriverStopType {
    if (detail.order_header) return DriverStopType.ORDER;
    if (detail.one_off_purchase_header || detail.one_off_purchase) {
      return DriverStopType.ONE_OFF;
    }
    if (detail.cancellation_order) return DriverStopType.CANCELLATION;
    if (detail.cycle_payment) return DriverStopType.COLLECTION;
    return DriverStopType.ORDER;
  }

  private buildItems(detail: StopRow): DriverDeliverySummaryItemDto[] {
    const order = detail.order_header;
    if (order) {
      return order.order_item
        .map((item) => ({
          product_id: item.product_id,
          product_description: item.product.description,
          quantity: item.quantity,
          delivered_quantity: item.delivered_quantity ?? 0,
          pending_quantity: Math.max(
            item.quantity - (item.delivered_quantity ?? 0),
            0,
          ),
          unit_price: item.unit_price.toFixed(2),
          subtotal: item.subtotal.toFixed(2),
        }))
        .sort((left, right) => left.product_id - right.product_id);
    }

    const purchase = detail.one_off_purchase;
    if (purchase) {
      const unitPrice =
        purchase.quantity > 0
          ? purchase.total_amount.div(purchase.quantity).toFixed(2)
          : purchase.total_amount.toFixed(2);
      return [
        {
          product_id: purchase.product_id,
          product_description: purchase.product.description,
          quantity: purchase.quantity,
          delivered_quantity: purchase.delivered_quantity ?? 0,
          pending_quantity: Math.max(
            purchase.quantity - (purchase.delivered_quantity ?? 0),
            0,
          ),
          unit_price: unitPrice,
          subtotal: purchase.total_amount.toFixed(2),
        },
      ];
    }

    const header = detail.one_off_purchase_header;
    if (header) {
      return header.purchase_items
        .map((item) => ({
          product_id: item.product_id,
          product_description: item.product.description,
          quantity: item.quantity,
          delivered_quantity: 0,
          pending_quantity: item.quantity,
          unit_price: item.unit_price.toFixed(2),
          subtotal: item.subtotal.toFixed(2),
        }))
        .sort((left, right) => left.product_id - right.product_id);
    }

    return [];
  }

  /** Productos y cantidades todavía pendientes de entregar, por producto. */
  private pendingItems(
    detail: StopRow,
  ): { product_id: number; quantity: number }[] {
    const merged = new Map<number, number>();
    const add = (productId: number, quantity: number) => {
      if (quantity <= 0) return;
      merged.set(productId, (merged.get(productId) ?? 0) + quantity);
    };

    if (detail.order_header) {
      for (const item of detail.order_header.order_item) {
        add(item.product_id, item.quantity - (item.delivered_quantity ?? 0));
      }
    } else if (detail.one_off_purchase) {
      const purchase = detail.one_off_purchase;
      add(
        purchase.product_id,
        purchase.quantity - (purchase.delivered_quantity ?? 0),
      );
    } else if (detail.one_off_purchase_header) {
      for (const item of detail.one_off_purchase_header.purchase_items) {
        add(item.product_id, item.quantity);
      }
    }

    return [...merged.entries()]
      .sort(([left], [right]) => left - right)
      .map(([product_id, quantity]) => ({ product_id, quantity }));
  }

  private buildTotals(detail: StopRow): DriverDeliverySummaryTotalsDto {
    let total = new Prisma.Decimal(0);
    let paid = new Prisma.Decimal(0);
    if (detail.order_header) {
      total = new Prisma.Decimal(detail.order_header.total_amount);
      paid = new Prisma.Decimal(detail.order_header.paid_amount);
    } else if (detail.one_off_purchase_header) {
      total = new Prisma.Decimal(detail.one_off_purchase_header.total_amount);
      paid = new Prisma.Decimal(
        detail.one_off_purchase_header.paid_amount ?? 0,
      );
    } else if (detail.one_off_purchase) {
      total = new Prisma.Decimal(detail.one_off_purchase.total_amount);
      paid = new Prisma.Decimal(detail.one_off_purchase.paid_amount ?? 0);
    } else if (detail.cycle_payment) {
      const cycle = detail.cycle_payment.subscription_cycle;
      total = new Prisma.Decimal(cycle.total_amount ?? 0);
      paid = new Prisma.Decimal(cycle.paid_amount);
    }
    const pending = total.minus(paid);
    return {
      total_amount: total.toFixed(2),
      paid_amount: paid.toFixed(2),
      pending_amount: (pending.gt(0) ? pending : new Prisma.Decimal(0)).toFixed(
        2,
      ),
    };
  }

  private buildCustomer(detail: StopRow): DriverDeliveryDetailCustomerDto {
    const person =
      detail.order_header?.customer ??
      detail.one_off_purchase_header?.person ??
      detail.one_off_purchase?.person ??
      detail.cancellation_order?.customer_subscription.person ??
      detail.cycle_payment?.subscription_cycle.customer_subscription.person ??
      null;
    if (!person) {
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
    const deliveryAddress =
      detail.one_off_purchase_header?.delivery_address ??
      detail.one_off_purchase?.delivery_address ??
      null;
    return {
      person_id: person.person_id,
      name: person.name ?? null,
      alias: person.alias ?? null,
      address: deliveryAddress || person.address || null,
      phone: person.phone,
      location: null,
      tax_id: person.tax_id ?? null,
      notes: null,
    };
  }

  private version(detail: StopRow): string {
    return buildDeliveryVersion({
      route_sheet_detail_id: detail.route_sheet_detail_id,
      delivery_status: detail.delivery_status,
      comments: detail.comments,
      actual_arrival_time: detail.actual_arrival_time,
      order_header: detail.order_header
        ? {
            status: detail.order_header.status,
            paid_amount: detail.order_header.paid_amount,
          }
        : null,
    });
  }

  /** Descuenta el stock de cada producto sin repetir movimientos ya aplicados. */
  private async applyStockForItems(
    tx: Prisma.TransactionClient,
    routeSheetId: number,
    detailId: number,
    items: { product_id: number; quantity: number }[],
  ): Promise<void> {
    if (items.length === 0) return;
    const originKey = (productId: number) =>
      `DELIVERY:${detailId}:${productId}`;
    const existing = await tx.inventory_transaction.findMany({
      where: {
        origin_key: { in: items.map((item) => originKey(item.product_id)) },
      },
      select: { origin_key: true },
    });
    const alreadyApplied = new Set(existing.map((row) => row.origin_key));

    for (const item of items) {
      if (alreadyApplied.has(originKey(item.product_id))) continue;
      await this.inventoryService.applyDeliveryStock(tx, {
        route_sheet_id: routeSheetId,
        detail_id: detailId,
        product_id: item.product_id,
        quantity: item.quantity,
      });
    }
  }

  /** Marca el pedido o compra puntual asociado como entregado. */
  private async syncObligationStatus(
    tx: Prisma.TransactionClient,
    detail: StopRow,
  ): Promise<void> {
    if (detail.order_header) {
      await tx.order_header.update({
        where: { order_id: detail.order_header.order_id },
        data: { status: OrderStatus.DELIVERED },
      });
      return;
    }
    if (detail.one_off_purchase) {
      await tx.one_off_purchase.update({
        where: { purchase_id: detail.one_off_purchase.purchase_id },
        data: { status: DeliveryStatus.DELIVERED },
      });
      return;
    }
    if (detail.one_off_purchase_header) {
      await tx.one_off_purchase_header.update({
        where: {
          purchase_header_id: detail.one_off_purchase_header.purchase_header_id,
        },
        data: {
          status: DeliveryStatus.DELIVERED,
          delivery_status: DeliveryStatus.DELIVERED,
        },
      });
    }
  }

  private async buildConfirmation(
    driverId: number,
    routeSheetId: number,
    detail: StopRow,
    deliveredItems: { product_id: number; quantity: number }[],
    signaturePresent: boolean,
    missingReason: string | null,
    orderStatus: string | null,
    idempotentReplay: boolean,
  ): Promise<DriverDeliveryConfirmationResultDto> {
    const delivery = await this.routeSheetsService.findDeliveryForDriver(
      driverId,
      routeSheetId,
      detail.route_sheet_detail_id,
    );
    const items: DriverDeliveredItemDto[] = deliveredItems.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));
    return {
      route_sheet_id: routeSheetId,
      route_sheet_detail_id: detail.route_sheet_detail_id,
      delivery_status: delivery.delivery_status,
      order_status: orderStatus,
      signature_present: signaturePresent,
      signature_missing_reason: missingReason,
      delivered_items: items,
      idempotent_replay: idempotentReplay,
      delivery,
    };
  }

  /** Traduce una carrera sobre la clave de origen a un conflicto reintentable. */
  private async runConfirmation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'La entrega se está procesando. Reintentá la confirmación.',
        );
      }
      throw error;
    }
  }

  private async saveSignatureFile(
    dataUri: string,
    detailId: number,
  ): Promise<string> {
    const matches = /^data:([A-Za-z-+/]+);base64,(.+)$/.exec(dataUri);
    if (!matches) {
      throw new BadRequestException(
        'La firma debe ser un data URI base64 (data:image/png;base64,...)',
      );
    }
    const extension = SIGNATURE_EXTENSIONS[matches[1]];
    if (!extension) {
      throw new BadRequestException(
        'Formato de firma no soportado: usá PNG o JPEG',
      );
    }
    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException('La firma está vacía');
    }
    if (buffer.length > MAX_SIGNATURE_BYTES) {
      throw new BadRequestException(
        'La firma supera el tamaño máximo permitido (2 MB)',
      );
    }

    const fileName = `${SIGNATURE_EVIDENCE_TYPE.toLowerCase()}_${detailId}_${Date.now()}.${extension}`;
    await fs.ensureDir(this.evidencePath);
    await fs.writeFile(path.join(this.evidencePath, fileName), buffer);
    return fileName;
  }

  private nowHHMM(): string {
    return new Date().toTimeString().slice(0, 5);
  }
}
