/**
 * Eventos de envíos que pueden convertirse en paradas extra de una hoja de
 * ruta ya creada. Los emiten los endpoints administrativos que crean pedidos;
 * los procesos internos (planificación automática, cobranzas) no los emiten.
 */
export const DELIVERY_CREATED_EVENT = 'delivery.created';

export type DeliveryReferenceKind = 'order' | 'one_off_purchase_header';

export interface DeliveryCreatedEvent {
  kind: DeliveryReferenceKind;
  /** order_id o purchase_header_id según `kind`. */
  id: number;
  /** Usuario que creó el envío, para el log. */
  created_by?: number | null;
}
