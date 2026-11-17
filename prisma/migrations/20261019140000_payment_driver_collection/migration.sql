-- Cobros del chofer en ruta.
-- Agrega a payment_transaction la trazabilidad del cobro (parada, efectivo
-- recibido y vuelto) y la clave de idempotencia persistida, y crea la tabla de
-- comprobantes (evidencia, no acreditación automatica del pago).

ALTER TABLE "public"."payment_transaction"
  ADD COLUMN "route_sheet_detail_id" INTEGER,
  ADD COLUMN "amount_received" DECIMAL(10, 2),
  ADD COLUMN "change_amount" DECIMAL(10, 2),
  ADD COLUMN "idempotency_key" VARCHAR(80),
  ADD COLUMN "idempotency_hash" VARCHAR(64);

-- Clave de idempotencia: en Postgres los NULL no colisionan, asi que los pagos
-- historicos sin clave conviven con la restriccion.
CREATE UNIQUE INDEX "payment_transaction_idempotency_key_key"
  ON "public"."payment_transaction"("idempotency_key");

ALTER TABLE "public"."payment_transaction"
  ADD CONSTRAINT "fk_payment_transaction_route_detail"
  FOREIGN KEY ("route_sheet_detail_id")
  REFERENCES "public"."route_sheet_detail"("route_sheet_detail_id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE "public"."payment_proof" (
  "proof_id" SERIAL NOT NULL,
  "route_sheet_detail_id" INTEGER NOT NULL,
  "payment_transaction_id" INTEGER,
  "kind" VARCHAR(30) NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "notes" TEXT,
  "uploaded_by" INTEGER,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "payment_proof_pkey" PRIMARY KEY ("proof_id")
);

CREATE INDEX "payment_proof_route_sheet_detail_id_idx"
  ON "public"."payment_proof"("route_sheet_detail_id");

CREATE INDEX "payment_proof_payment_transaction_id_idx"
  ON "public"."payment_proof"("payment_transaction_id");

ALTER TABLE "public"."payment_proof"
  ADD CONSTRAINT "fk_payment_proof_route_detail"
  FOREIGN KEY ("route_sheet_detail_id")
  REFERENCES "public"."route_sheet_detail"("route_sheet_detail_id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."payment_proof"
  ADD CONSTRAINT "fk_payment_proof_transaction"
  FOREIGN KEY ("payment_transaction_id")
  REFERENCES "public"."payment_transaction"("transaction_id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
