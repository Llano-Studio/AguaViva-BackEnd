import { RouteSheetExecutionStatus } from '@prisma/client';
import { RESOLVED_DELIVERY_STATUSES } from '../delivery-locks';

/** Origen de una parada extra. */
export const EXTRA_SOURCE = {
  /** Agregada sola al crearse el pedido (evento `delivery.created`). */
  ORDER_EVENT: 'ORDER_EVENT',
  /** Agregada por administración con POST /route-sheets/:id/details. */
  MANUAL: 'MANUAL',
} as const;

export type ExtraDeliverySource =
  (typeof EXTRA_SOURCE)[keyof typeof EXTRA_SOURCE];

/** Hojas que todavía pueden recibir paradas. */
export const EXTRA_TARGET_STATUSES: RouteSheetExecutionStatus[] = [
  RouteSheetExecutionStatus.PLANNED,
  RouteSheetExecutionStatus.IN_PROGRESS,
  RouteSheetExecutionStatus.PAUSED,
];

/**
 * Elige la hoja destino entre las del día cuyo móvil cubre la zona del
 * cliente. Si hay más de una, gana la más antigua (menor ID), que es la que el
 * planificador arma primero: el resultado no depende del orden de la consulta.
 */
export function pickTargetRouteSheet<T extends { route_sheet_id: number }>(
  candidates: T[],
): T | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, sheet) =>
    sheet.route_sheet_id < best.route_sheet_id ? sheet : best,
  );
}

/**
 * Divide una hoja en curso, ya ordenada por recorrido, para reoptimizarla sin
 * cambiarle el trabajo al chofer:
 *
 * - `fixed`: las paradas resueltas y la parada actual (la primera sin
 *   resolver), que el chofer ya tiene adelante. Conservan su orden.
 * - `anchor`: la parada actual; el tramo nuevo sale desde ahí.
 * - `reorderable`: las pendientes posteriores, que se pueden reordenar.
 */
export function splitForReoptimization<
  T extends { route_sheet_detail_id: number; delivery_status: string },
>(ordered: T[]): { fixed: T[]; anchor: T | null; reorderable: T[] } {
  const isResolved = (stop: T) =>
    RESOLVED_DELIVERY_STATUSES.has(stop.delivery_status);
  const firstPending = ordered.findIndex((stop) => !isResolved(stop));
  if (firstPending === -1) {
    return { fixed: [...ordered], anchor: null, reorderable: [] };
  }

  const rest = ordered.slice(firstPending + 1);
  return {
    fixed: [...ordered.slice(0, firstPending + 1), ...rest.filter(isResolved)],
    anchor: ordered[firstPending],
    reorderable: rest.filter((stop) => !isResolved(stop)),
  };
}
