import { Prisma, RouteSheetExecutionStatus } from '@prisma/client';
import { DeliveryStatus } from '../common/constants/enums';

/**
 * Estados de entrega que ya no requieren acción del chofer.
 * VISITED queda fuera: una visita sin venta mantiene la parada como actual y
 * todavía habilita entregar u omitir (no volver a visitar).
 */
export const RESOLVED_DELIVERY_STATUSES: ReadonlySet<string> = new Set([
  DeliveryStatus.DELIVERED,
  DeliveryStatus.FAILED,
  DeliveryStatus.SKIPPED,
]);

export const NOT_DELIVERED_STATUSES: ReadonlySet<string> = new Set([
  DeliveryStatus.FAILED,
  DeliveryStatus.SKIPPED,
]);

/** La hoja sigue en poder del chofer mientras esté en curso o pausada. */
export const OPEN_EXECUTION_STATUSES: RouteSheetExecutionStatus[] = [
  RouteSheetExecutionStatus.IN_PROGRESS,
  RouteSheetExecutionStatus.PAUSED,
];

/**
 * Orden del recorrido. Es también el que define cuál es la parada actual, así
 * que la lectura de la hoja y las validaciones de escritura deben usar el mismo.
 */
export const DELIVERY_SEQUENCE_ORDER_BY: Prisma.route_sheet_detailOrderByWithRelationInput[] =
  [
    { sequence_number: { sort: 'asc', nulls: 'last' } },
    { route_sheet_detail_id: 'asc' },
  ];

/**
 * Marca cuál es la entrega habilitada: la primera sin resolver en el orden del
 * recorrido, y solo si la hoja está en curso. Las demás pendientes quedan
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

/**
 * Indica si `detailId` es la parada habilitada de la hoja: la primera sin
 * resolver del recorrido, con la hoja en curso.
 */
export function isCurrentDelivery(
  details: { route_sheet_detail_id: number; delivery_status: string }[],
  detailId: number,
  executionStatus: RouteSheetExecutionStatus,
): boolean {
  const { currentIndex } = computeDeliveryLocks(
    details.map((d) => d.delivery_status),
    executionStatus,
  );
  return (
    currentIndex !== null &&
    details[currentIndex].route_sheet_detail_id === detailId
  );
}
