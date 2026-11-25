-- Ubicación de los clientes para el optimizador de recorridos.
ALTER TABLE "public"."person"
  ADD COLUMN IF NOT EXISTS "lat" DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS "lng" DECIMAL(11,8),
  ADD COLUMN IF NOT EXISTS "geo_source" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "geo_precision" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "geo_updated_at" TIMESTAMP(3);
