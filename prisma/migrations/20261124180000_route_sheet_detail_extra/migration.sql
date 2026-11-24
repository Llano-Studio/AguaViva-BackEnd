-- Paradas agregadas a una hoja de ruta ya creada (pedidos extra).
ALTER TABLE "public"."route_sheet_detail"
  ADD COLUMN "is_extra" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "extra_source" VARCHAR(20),
  ADD COLUMN "extra_added_at" TIMESTAMP(3);
