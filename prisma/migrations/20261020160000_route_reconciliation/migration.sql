-- Rendicion y cuenta corriente del chofer.
--
-- route_reconciliation guarda el snapshot auditable del cierre de una hoja
-- (una sola rendicion por hoja, de ahi el indice unico). driver_account_movement
-- registra los movimientos inmutables de la cuenta del chofer: el saldo no se
-- persiste, se reconstruye sumando los movimientos.

CREATE TABLE "public"."route_reconciliation" (
    "reconciliation_id" SERIAL NOT NULL,
    "route_sheet_id" INTEGER NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "cash_to_render" DECIMAL(10, 2) NOT NULL,
    "electronic_total" DECIMAL(10, 2) NOT NULL,
    "total_collected" DECIMAL(10, 2) NOT NULL,
    "collections_by_method" JSONB NOT NULL,
    "product_summary" JSONB NOT NULL,
    "differences" JSONB,
    "version" VARCHAR(64) NOT NULL,
    "signature_path" TEXT,
    "idempotency_key" VARCHAR(80),
    "notes" TEXT,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_at" TIMESTAMP(3),
    "received_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "route_reconciliation_pkey" PRIMARY KEY ("reconciliation_id")
);

CREATE UNIQUE INDEX "route_reconciliation_route_sheet_id_key"
  ON "public"."route_reconciliation"("route_sheet_id");

CREATE UNIQUE INDEX "route_reconciliation_idempotency_key_key"
  ON "public"."route_reconciliation"("idempotency_key");

CREATE TABLE "public"."driver_account_movement" (
    "movement_id" SERIAL NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "movement_type" VARCHAR(30) NOT NULL,
    "amount" DECIMAL(10, 2) NOT NULL,
    "route_sheet_id" INTEGER,
    "reconciliation_id" INTEGER,
    "reference" VARCHAR(80),
    "origin_key" VARCHAR(100),
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "driver_account_movement_pkey" PRIMARY KEY ("movement_id")
);

CREATE UNIQUE INDEX "driver_account_movement_origin_key_key"
  ON "public"."driver_account_movement"("origin_key");

CREATE INDEX "driver_account_movement_driver_id_created_at_idx"
  ON "public"."driver_account_movement"("driver_id", "created_at");

ALTER TABLE "public"."route_reconciliation"
  ADD CONSTRAINT "fk_route_reconciliation_route_sheet"
  FOREIGN KEY ("route_sheet_id") REFERENCES "public"."route_sheet"("route_sheet_id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."route_reconciliation"
  ADD CONSTRAINT "fk_route_reconciliation_driver"
  FOREIGN KEY ("driver_id") REFERENCES "public"."User"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."route_reconciliation"
  ADD CONSTRAINT "fk_route_reconciliation_received_by"
  FOREIGN KEY ("received_by") REFERENCES "public"."User"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."driver_account_movement"
  ADD CONSTRAINT "fk_driver_account_movement_driver"
  FOREIGN KEY ("driver_id") REFERENCES "public"."User"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."driver_account_movement"
  ADD CONSTRAINT "fk_driver_account_movement_created_by"
  FOREIGN KEY ("created_by") REFERENCES "public"."User"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."driver_account_movement"
  ADD CONSTRAINT "fk_driver_account_movement_reconciliation"
  FOREIGN KEY ("reconciliation_id") REFERENCES "public"."route_reconciliation"("reconciliation_id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
