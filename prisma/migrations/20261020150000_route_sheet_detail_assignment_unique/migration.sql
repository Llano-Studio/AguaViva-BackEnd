-- Evita asignar la misma parada dos veces dentro de una hoja de ruta.
--
-- El reasignador automático y las operaciones administrativas (inserción
-- incremental, reprogramación) pueden apuntar al mismo pedido sobre la misma
-- hoja: con estos índices el segundo intento falla con conflicto en lugar de
-- duplicar la parada destino.
--
-- Se versiona aquí y no en schema.prisma porque Prisma no expresa índices
-- parciales; el índice completo sobre columnas nullable tiene el mismo efecto,
-- dado que en Postgres los NULL no se consideran iguales entre sí (las paradas
-- de otro tipo quedan con la referencia nula y no colisionan).

CREATE UNIQUE INDEX "unique_route_sheet_detail_order"
  ON "public"."route_sheet_detail"("route_sheet_id", "order_id");

CREATE UNIQUE INDEX "unique_route_sheet_detail_one_off"
  ON "public"."route_sheet_detail"("route_sheet_id", "one_off_purchase_id");

CREATE UNIQUE INDEX "unique_route_sheet_detail_one_off_header"
  ON "public"."route_sheet_detail"("route_sheet_id", "one_off_purchase_header_id");

CREATE UNIQUE INDEX "unique_route_sheet_detail_cycle_payment"
  ON "public"."route_sheet_detail"("route_sheet_id", "cycle_payment_id");
