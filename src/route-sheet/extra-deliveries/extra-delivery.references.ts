import { PrismaService } from '../../prisma/prisma.service';
import { formatBAYMD } from '../../common/utils/date.utils';
import { DeliveryCreatedEvent } from './extra-delivery.events';

/** Estados de pedido que ya no se entregan. */
const CLOSED_ORDER_STATUSES = new Set([
  'DELIVERED',
  'RETIRADO',
  'CANCELLED',
  'REFUNDED',
]);

/** Datos del envío que deciden a qué hoja va, y cómo se carga como parada. */
export interface DeliveryReference {
  /** Fecha de entrega (Buenos Aires, YYYY-MM-DD). */
  delivery_ymd: string;
  zone_id: number | null;
  is_deliverable: boolean;
  /** Referencia con la que se guarda la parada (mismo formato que el DTO). */
  detail: {
    order_id?: number;
    order_type?: any;
    one_off_purchase_header_id?: number;
  };
  /** Filtro de route_sheet_detail para saber si ya está en alguna hoja. */
  detail_where: { order_id?: number; one_off_purchase_header_id?: number };
}

/**
 * AguaViva: pedidos (order_header) y compras únicas con cabecera
 * (one_off_purchase_header). La fecha es la de entrega programada o, si no
 * tiene, la de creación; la zona, la del envío o la del cliente.
 */
export async function loadDeliveryReference(
  prisma: PrismaService,
  event: DeliveryCreatedEvent,
): Promise<DeliveryReference | null> {
  if (event.kind === 'order') {
    const order = await prisma.order_header.findUnique({
      where: { order_id: event.id },
      select: {
        order_id: true,
        order_type: true,
        status: true,
        order_date: true,
        scheduled_delivery_date: true,
        zone_id: true,
        customer: { select: { zone_id: true } },
      },
    });
    if (!order) return null;
    return {
      delivery_ymd: formatBAYMD(
        order.scheduled_delivery_date ?? order.order_date,
      ),
      zone_id: order.zone_id ?? order.customer?.zone_id ?? null,
      is_deliverable: !CLOSED_ORDER_STATUSES.has(order.status),
      detail: { order_id: order.order_id, order_type: order.order_type },
      detail_where: { order_id: order.order_id },
    };
  }

  if (event.kind === 'one_off_purchase_header') {
    const purchase = await prisma.one_off_purchase_header.findUnique({
      where: { purchase_header_id: event.id },
      select: {
        purchase_header_id: true,
        status: true,
        delivery_status: true,
        purchase_date: true,
        scheduled_delivery_date: true,
        zone_id: true,
        person: { select: { zone_id: true } },
      },
    });
    if (!purchase) return null;
    return {
      delivery_ymd: formatBAYMD(
        purchase.scheduled_delivery_date ?? purchase.purchase_date,
      ),
      zone_id: purchase.zone_id ?? purchase.person?.zone_id ?? null,
      is_deliverable:
        !CLOSED_ORDER_STATUSES.has(purchase.status) &&
        purchase.delivery_status !== 'DELIVERED',
      detail: { one_off_purchase_header_id: purchase.purchase_header_id },
      detail_where: { one_off_purchase_header_id: purchase.purchase_header_id },
    };
  }

  return null;
}
