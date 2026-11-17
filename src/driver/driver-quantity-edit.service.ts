import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionQuotaService } from '../common/services/subscription-quota.service';
import { formatBATimestampISO } from '../common/utils/date.utils';
import {
  OPEN_EXECUTION_STATUSES,
  RESOLVED_DELIVERY_STATUSES,
} from '../route-sheet/delivery-locks';
import { DriverDeliveriesService } from './driver-deliveries.service';
import {
  DriverDeliverySummaryDto,
  EnableQuantityEditDto,
  QuantityEditAuthorizationDto,
  QuantityEditChangeDto,
  UpdateDeliveryItemsDto,
} from './dto';

const SIGNATURE_EVIDENCE_TYPE = 'SIGNATURE';

const EDIT_DETAIL_INCLUDE = {
  route_sheet: {
    select: { driver_id: true, is_active: true, execution_status: true },
  },
  order_header: {
    select: {
      order_id: true,
      subscription_id: true,
      total_amount: true,
      paid_amount: true,
      order_item: {
        select: {
          order_item_id: true,
          product_id: true,
          quantity: true,
          delivered_quantity: true,
          unit_price: true,
          subtotal: true,
        },
        orderBy: { order_item_id: 'desc' },
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
    },
  },
  one_off_purchase_header: {
    select: {
      purchase_header_id: true,
      total_amount: true,
      paid_amount: true,
      purchase_items: {
        select: {
          purchase_item_id: true,
          product_id: true,
          quantity: true,
          unit_price: true,
          subtotal: true,
        },
        orderBy: { purchase_item_id: 'desc' },
      },
    },
  },
} satisfies Prisma.route_sheet_detailInclude;

type EditDetailRow = Prisma.route_sheet_detailGetPayload<{
  include: typeof EDIT_DETAIL_INCLUDE;
}>;

interface ItemLine {
  id: number;
  productId: number;
  quantity: number;
  delivered: number;
}

function paymentStatusFor(total: Prisma.Decimal, paid: Prisma.Decimal): string {
  if (paid.gte(total)) return 'PAID';
  if (paid.lte(0)) return 'PENDING';
  return 'PARTIAL';
}

/**
 * Cantidad de un ítem que se cobra. En los pedidos con abono, lo cubierto por
 * la cuota queda a precio 0 y el subtotal refleja solo el excedente.
 */
function chargedQuantity(item: {
  quantity: number;
  unit_price: Prisma.Decimal;
  subtotal: Prisma.Decimal;
}): number {
  const unitPrice = new Prisma.Decimal(item.unit_price);
  if (unitPrice.lte(0)) return 0;
  const charged = new Prisma.Decimal(item.subtotal)
    .div(unitPrice)
    .round()
    .toNumber();
  return Math.min(Math.max(charged, 0), item.quantity);
}

/**
 * Cuando el cliente recibe menos de lo pedido, administración habilita la
 * parada y el chofer reduce las cantidades. Se ajustan los ítems y el total
 * del pedido; en pedidos con abono, lo que estaba cubierto por la cuota vuelve
 * al ciclo. Cada habilitación sirve para una sola edición.
 */
@Injectable()
export class DriverQuantityEditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionQuotaService: SubscriptionQuotaService,
    private readonly driverDeliveriesService: DriverDeliveriesService,
  ) {}

  async enable(
    adminId: number,
    detailId: number,
    dto: EnableQuantityEditDto,
  ): Promise<QuantityEditAuthorizationDto> {
    const detail = await this.loadDetail(detailId);
    this.assertEditableStop(detail);

    const open = await this.findOpen(detailId);
    if (open) return this.toDto(open);

    const created = await this.prisma.delivery_quantity_edit.create({
      data: {
        route_sheet_detail_id: detailId,
        reason: dto.reason.trim(),
        enabled_by: adminId,
      },
    });
    return this.toDto(created);
  }

  async revoke(
    adminId: number,
    detailId: number,
  ): Promise<QuantityEditAuthorizationDto> {
    const open = await this.findOpen(detailId);
    if (!open) {
      throw new NotFoundException(
        `La parada ${detailId} no tiene una edición de cantidades habilitada`,
      );
    }
    const revoked = await this.prisma.delivery_quantity_edit.update({
      where: { edit_id: open.edit_id },
      data: { revoked_at: new Date(), revoked_by: adminId },
    });
    return this.toDto(revoked);
  }

  async findForDetail(
    detailId: number,
  ): Promise<QuantityEditAuthorizationDto[]> {
    await this.loadDetail(detailId);
    const rows = await this.prisma.delivery_quantity_edit.findMany({
      where: { route_sheet_detail_id: detailId },
      orderBy: { edit_id: 'desc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async hasOpenEdit(detailId: number): Promise<boolean> {
    return (await this.findOpen(detailId)) !== null;
  }

  /** El chofer baja cantidades de la parada usando la habilitación vigente. */
  async applyByDriver(
    driverId: number,
    detailId: number,
    dto: UpdateDeliveryItemsDto,
  ): Promise<DriverDeliverySummaryDto> {
    const detail = await this.loadDetail(detailId);
    const sheet = detail.route_sheet;
    if (!sheet || !sheet.is_active || sheet.driver_id !== driverId) {
      throw new NotFoundException(`Parada ${detailId} no encontrada`);
    }
    if (!OPEN_EXECUTION_STATUSES.includes(sheet.execution_status)) {
      throw new ConflictException('La hoja de ruta no está en curso');
    }
    this.assertEditableStop(detail);

    const authorization = await this.findOpen(detailId);
    if (!authorization) {
      throw new ConflictException(
        'Administración no habilitó la edición de cantidades de esta parada',
      );
    }
    const signature = await this.prisma.delivery_evidence.findFirst({
      where: {
        route_sheet_detail_id: detailId,
        evidence_type: SIGNATURE_EVIDENCE_TYPE,
      },
      select: { evidence_id: true },
    });
    if (signature) {
      throw new ConflictException(
        'La parada ya tiene la firma del cliente: las cantidades se ajustan antes de firmar',
      );
    }

    const requested = new Map<number, number>();
    for (const item of dto.items) {
      if (requested.has(item.product_id)) {
        throw new BadRequestException(
          `El producto ${item.product_id} aparece más de una vez`,
        );
      }
      requested.set(item.product_id, item.quantity);
    }

    const lines = this.itemLines(detail);
    const current = new Map<number, { quantity: number; delivered: number }>();
    for (const line of lines) {
      const entry = current.get(line.productId) ?? {
        quantity: 0,
        delivered: 0,
      };
      entry.quantity += line.quantity;
      entry.delivered += line.delivered;
      current.set(line.productId, entry);
    }

    const changes: QuantityEditChangeDto[] = [];
    for (const [productId, quantity] of requested) {
      const entry = current.get(productId);
      if (!entry) {
        throw new BadRequestException(
          `El producto ${productId} no está en esta parada`,
        );
      }
      if (quantity > entry.quantity) {
        throw new BadRequestException(
          `Solo se pueden reducir cantidades: el producto ${productId} tiene ${entry.quantity}`,
        );
      }
      if (quantity < entry.delivered) {
        throw new BadRequestException(
          `El producto ${productId} ya tiene ${entry.delivered} entregados`,
        );
      }
      if (quantity < entry.quantity) {
        changes.push({
          product_id: productId,
          from_quantity: entry.quantity,
          to_quantity: quantity,
        });
      }
    }
    if (changes.length === 0) {
      throw new BadRequestException('No hay ninguna cantidad para reducir');
    }
    const remainingTotal = [...current.entries()].reduce(
      (sum, [productId, entry]) =>
        sum + (requested.get(productId) ?? entry.quantity),
      0,
    );
    if (remainingTotal <= 0) {
      throw new BadRequestException(
        'No se puede dejar la parada sin productos: si el cliente no recibe nada, salteá la parada',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const used = await tx.delivery_quantity_edit.updateMany({
        where: {
          edit_id: authorization.edit_id,
          used_at: null,
          revoked_at: null,
        },
        data: {
          used_at: new Date(),
          used_by: driverId,
          changes: changes as unknown as Prisma.InputJsonValue,
        },
      });
      if (used.count !== 1) {
        throw new ConflictException('La habilitación ya fue usada o revocada');
      }
      if (detail.order_header) {
        await this.reduceOrder(tx, detail.order_header, changes);
      } else if (detail.one_off_purchase_header) {
        await this.reduceOneOffHeader(
          tx,
          detail.one_off_purchase_header,
          changes,
        );
      } else if (detail.one_off_purchase) {
        await this.reduceLegacyOneOff(tx, detail.one_off_purchase, changes);
      }
    });

    return this.driverDeliveriesService.getSummary(driverId, detailId);
  }

  private async reduceOrder(
    tx: Prisma.TransactionClient,
    order: NonNullable<EditDetailRow['order_header']>,
    changes: QuantityEditChangeDto[],
  ): Promise<void> {
    let delta = new Prisma.Decimal(0);
    const quotaToRestore: { product_id: number; quantity: number }[] = [];

    for (const change of changes) {
      let toRemove = change.from_quantity - change.to_quantity;
      let quotaReleased = 0;
      for (const item of order.order_item) {
        if (item.product_id !== change.product_id || toRemove <= 0) continue;
        const removable = item.quantity - (item.delivered_quantity ?? 0);
        const removed = Math.min(removable, toRemove);
        if (removed <= 0) continue;
        // Primero se descuenta lo que se cobra; después lo cubierto por la cuota.
        const charged = order.subscription_id
          ? chargedQuantity(item)
          : item.quantity;
        const chargedRemoved = Math.min(removed, charged);
        quotaReleased += removed - chargedRemoved;
        const reduction = new Prisma.Decimal(item.unit_price).mul(
          chargedRemoved,
        );
        delta = delta.plus(reduction);
        await tx.order_item.update({
          where: { order_item_id: item.order_item_id },
          data: {
            quantity: item.quantity - removed,
            subtotal: new Prisma.Decimal(item.subtotal)
              .minus(reduction)
              .toFixed(2),
          },
        });
        toRemove -= removed;
      }
      if (order.subscription_id && quotaReleased > 0) {
        quotaToRestore.push({
          product_id: change.product_id,
          quantity: quotaReleased,
        });
      }
    }

    const total = new Prisma.Decimal(order.total_amount).minus(delta);
    const paid = new Prisma.Decimal(order.paid_amount);
    if (paid.gt(total)) {
      throw new ConflictException(
        `Ya se cobraron ${paid.toFixed(2)} y el nuevo total sería ${total.toFixed(2)}: ajustá el cobro antes de reducir`,
      );
    }
    await tx.order_header.update({
      where: { order_id: order.order_id },
      data: {
        total_amount: total.toFixed(2),
        payment_status: paymentStatusFor(total, paid),
      },
    });
    if (order.subscription_id && quotaToRestore.length > 0) {
      await this.subscriptionQuotaService.resetCreditsForDeletedOrder(
        order.subscription_id,
        quotaToRestore,
        tx,
      );
    }
  }

  private async reduceOneOffHeader(
    tx: Prisma.TransactionClient,
    header: NonNullable<EditDetailRow['one_off_purchase_header']>,
    changes: QuantityEditChangeDto[],
  ): Promise<void> {
    let delta = new Prisma.Decimal(0);
    for (const change of changes) {
      let toRemove = change.from_quantity - change.to_quantity;
      for (const item of header.purchase_items) {
        if (item.product_id !== change.product_id || toRemove <= 0) continue;
        const removed = Math.min(item.quantity, toRemove);
        const reduction = new Prisma.Decimal(item.unit_price).mul(removed);
        delta = delta.plus(reduction);
        await tx.one_off_purchase_item.update({
          where: { purchase_item_id: item.purchase_item_id },
          data: {
            quantity: item.quantity - removed,
            subtotal: new Prisma.Decimal(item.subtotal)
              .minus(reduction)
              .toFixed(2),
          },
        });
        toRemove -= removed;
      }
    }
    const total = new Prisma.Decimal(header.total_amount).minus(delta);
    const paid = new Prisma.Decimal(header.paid_amount ?? 0);
    if (paid.gt(total)) {
      throw new ConflictException(
        `Ya se cobraron ${paid.toFixed(2)} y el nuevo total sería ${total.toFixed(2)}: ajustá el cobro antes de reducir`,
      );
    }
    await tx.one_off_purchase_header.update({
      where: { purchase_header_id: header.purchase_header_id },
      data: {
        total_amount: total.toFixed(2),
        payment_status: paymentStatusFor(total, paid),
      },
    });
  }

  private async reduceLegacyOneOff(
    tx: Prisma.TransactionClient,
    purchase: NonNullable<EditDetailRow['one_off_purchase']>,
    changes: QuantityEditChangeDto[],
  ): Promise<void> {
    const change = changes[0];
    const unitPrice =
      purchase.quantity > 0
        ? new Prisma.Decimal(purchase.total_amount).div(purchase.quantity)
        : new Prisma.Decimal(0);
    const total = unitPrice
      .mul(change.to_quantity)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const paid = new Prisma.Decimal(purchase.paid_amount ?? 0);
    if (paid.gt(total)) {
      throw new ConflictException(
        `Ya se cobraron ${paid.toFixed(2)} y el nuevo total sería ${total.toFixed(2)}: ajustá el cobro antes de reducir`,
      );
    }
    await tx.one_off_purchase.update({
      where: { purchase_id: purchase.purchase_id },
      data: { quantity: change.to_quantity, total_amount: total.toFixed(2) },
    });
  }

  private itemLines(detail: EditDetailRow): ItemLine[] {
    if (detail.order_header) {
      return detail.order_header.order_item.map((item) => ({
        id: item.order_item_id,
        productId: item.product_id,
        quantity: item.quantity,
        delivered: item.delivered_quantity ?? 0,
      }));
    }
    if (detail.one_off_purchase_header) {
      return detail.one_off_purchase_header.purchase_items.map((item) => ({
        id: item.purchase_item_id,
        productId: item.product_id,
        quantity: item.quantity,
        delivered: 0,
      }));
    }
    if (detail.one_off_purchase) {
      const purchase = detail.one_off_purchase;
      return [
        {
          id: purchase.purchase_id,
          productId: purchase.product_id,
          quantity: purchase.quantity,
          delivered: purchase.delivered_quantity ?? 0,
        },
      ];
    }
    return [];
  }

  private async loadDetail(detailId: number): Promise<EditDetailRow> {
    const detail = await this.prisma.route_sheet_detail.findUnique({
      where: { route_sheet_detail_id: detailId },
      include: EDIT_DETAIL_INCLUDE,
    });
    if (!detail) {
      throw new NotFoundException(`Parada ${detailId} no encontrada`);
    }
    return detail;
  }

  private assertEditableStop(detail: EditDetailRow): void {
    if (
      detail.delivery_status &&
      RESOLVED_DELIVERY_STATUSES.has(detail.delivery_status)
    ) {
      throw new ConflictException('La parada ya está resuelta');
    }
    if (
      !detail.order_header &&
      !detail.one_off_purchase_header &&
      !detail.one_off_purchase
    ) {
      throw new ConflictException(
        'Solo se pueden editar cantidades de paradas con productos (pedido o compra puntual)',
      );
    }
  }

  private findOpen(detailId: number) {
    return this.prisma.delivery_quantity_edit.findFirst({
      where: {
        route_sheet_detail_id: detailId,
        used_at: null,
        revoked_at: null,
      },
      orderBy: { edit_id: 'desc' },
    });
  }

  private toDto(row: {
    edit_id: number;
    route_sheet_detail_id: number;
    reason: string;
    enabled_by: number;
    enabled_at: Date;
    used_at: Date | null;
    revoked_at: Date | null;
    changes: Prisma.JsonValue | null;
  }): QuantityEditAuthorizationDto {
    return {
      edit_id: row.edit_id,
      route_sheet_detail_id: row.route_sheet_detail_id,
      reason: row.reason,
      enabled_by: row.enabled_by,
      enabled_at: formatBATimestampISO(row.enabled_at),
      used_at: row.used_at ? formatBATimestampISO(row.used_at) : null,
      revoked_at: row.revoked_at ? formatBATimestampISO(row.revoked_at) : null,
      changes: (row.changes as unknown as QuantityEditChangeDto[]) ?? null,
    };
  }
}
