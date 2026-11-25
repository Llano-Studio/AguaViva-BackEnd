import { PrismaService } from '../prisma/prisma.service';

/**
 * Cliente de una parada (AguaViva): pedido, compra única o compra única con
 * cabecera. Las cobranzas no tienen una entrega en la puerta del cliente.
 */
export async function detailCustomerId(
  prisma: PrismaService,
  detailId: number,
): Promise<number | null> {
  const detail = await prisma.route_sheet_detail.findUnique({
    where: { route_sheet_detail_id: detailId },
    select: {
      order_header: { select: { customer_id: true } },
      one_off_purchase: { select: { person_id: true } },
      one_off_purchase_header: { select: { person_id: true } },
    },
  });
  return (
    detail?.order_header?.customer_id ??
    detail?.one_off_purchase?.person_id ??
    detail?.one_off_purchase_header?.person_id ??
    null
  );
}
