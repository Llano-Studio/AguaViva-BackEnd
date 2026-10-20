-- Clave de origen de los movimientos de inventario.
--
-- Evita que un mismo descuento se cuente dos veces: si el dispositivo reintenta
-- una entrega ya registrada, el segundo intento choca contra esta clave y la
-- transacción revierte el descuento en lugar de bajar el stock otra vez.
--
-- Los movimientos históricos quedan con clave nula y no se tocan: en Postgres
-- los NULL no se consideran iguales entre sí, así que el índice no los bloquea.
-- Se versiona aquí y no en schema.prisma porque Prisma no expresa índices
-- parciales; el índice completo sobre una columna nullable tiene el mismo efecto.

ALTER TABLE "public"."inventory_transaction"
  ADD COLUMN "origin_key" VARCHAR(100);

CREATE UNIQUE INDEX "inventory_transaction_origin_key_key"
  ON "public"."inventory_transaction"("origin_key");
