-- Garantiza que un chofer no pueda tener dos hojas de ruta en curso a la vez,
-- incluso con dos solicitudes simultáneas desde dispositivos distintos.
--
-- La verificación previa en la aplicación (assertNoOtherInProgress) puede pasar
-- en dos transacciones concurrentes; este índice es el respaldo real de la base.
-- Prisma no puede expresar índices parciales en schema.prisma, por eso se crea
-- aquí y no en un @@index.

-- 1) Normaliza los datos existentes antes de crear la restricción: si un chofer
--    ya tuviera más de una hoja IN_PROGRESS activa, se conserva la iniciada más
--    recientemente y el resto vuelve a PLANNED, sin started_at.
UPDATE "public"."route_sheet" AS rs
SET "execution_status" = 'PLANNED',
    "started_at" = NULL
WHERE rs."is_active" = true
  AND rs."execution_status" = 'IN_PROGRESS'
  AND rs."route_sheet_id" <> (
    SELECT keep."route_sheet_id"
    FROM "public"."route_sheet" AS keep
    WHERE keep."driver_id" = rs."driver_id"
      AND keep."is_active" = true
      AND keep."execution_status" = 'IN_PROGRESS'
    ORDER BY keep."started_at" DESC NULLS LAST, keep."route_sheet_id" DESC
    LIMIT 1
  );

-- 2) Restricción para las escrituras futuras.
CREATE UNIQUE INDEX "route_sheet_one_in_progress_per_driver_key"
  ON "public"."route_sheet" ("driver_id")
  WHERE "execution_status" = 'IN_PROGRESS' AND "is_active" = true;
