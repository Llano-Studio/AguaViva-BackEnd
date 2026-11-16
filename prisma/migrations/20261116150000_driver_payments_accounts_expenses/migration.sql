-- CreateEnum
CREATE TYPE "public"."CustomerCurrentAccountType" AS ENUM ('NONE', 'OWN', 'DRIVER');

-- AlterTable
ALTER TABLE "public"."person" ADD COLUMN     "current_account_type" "public"."CustomerCurrentAccountType" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "public"."route_reconciliation" ADD COLUMN     "customer_account_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "driver_credit_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "expenses_total" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."driver_credit_charge" (
    "charge_id" SERIAL NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "route_sheet_id" INTEGER NOT NULL,
    "route_sheet_detail_id" INTEGER NOT NULL,
    "payment_transaction_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "settled_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "due_date" DATE NOT NULL,
    "interest_rate" DECIMAL(5,4) NOT NULL,
    "interest_base" DECIMAL(10,2),
    "interest_amount" DECIMAL(10,2),
    "interest_applied_at" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_credit_charge_pkey" PRIMARY KEY ("charge_id")
);

-- CreateTable
CREATE TABLE "public"."driver_credit_allocation" (
    "allocation_id" SERIAL NOT NULL,
    "charge_id" INTEGER NOT NULL,
    "movement_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_credit_allocation_pkey" PRIMARY KEY ("allocation_id")
);

-- CreateTable
CREATE TABLE "public"."delivery_payment_batch" (
    "batch_id" SERIAL NOT NULL,
    "route_sheet_detail_id" INTEGER NOT NULL,
    "idempotency_key" VARCHAR(80) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "customer_account_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_payment_batch_pkey" PRIMARY KEY ("batch_id")
);

-- CreateTable
CREATE TABLE "public"."driver_expense" (
    "expense_id" SERIAL NOT NULL,
    "route_sheet_id" INTEGER NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" VARCHAR(255),
    "receipt_reference" VARCHAR(100),
    "idempotency_key" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "voided_by" INTEGER,
    "voided_at" TIMESTAMP(3),
    "void_reason" VARCHAR(255),

    CONSTRAINT "driver_expense_pkey" PRIMARY KEY ("expense_id")
);

-- CreateTable
CREATE TABLE "public"."delivery_quantity_edit" (
    "edit_id" SERIAL NOT NULL,
    "route_sheet_detail_id" INTEGER NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "enabled_by" INTEGER NOT NULL,
    "enabled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_by" INTEGER,
    "used_at" TIMESTAMP(3),
    "revoked_by" INTEGER,
    "revoked_at" TIMESTAMP(3),
    "changes" JSONB,

    CONSTRAINT "delivery_quantity_edit_pkey" PRIMARY KEY ("edit_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "driver_credit_charge_payment_transaction_id_key" ON "public"."driver_credit_charge"("payment_transaction_id");

-- CreateIndex
CREATE INDEX "driver_credit_charge_driver_id_status_idx" ON "public"."driver_credit_charge"("driver_id", "status");

-- CreateIndex
CREATE INDEX "driver_credit_charge_status_due_date_idx" ON "public"."driver_credit_charge"("status", "due_date");

-- CreateIndex
CREATE INDEX "driver_credit_allocation_charge_id_idx" ON "public"."driver_credit_allocation"("charge_id");

-- CreateIndex
CREATE INDEX "driver_credit_allocation_movement_id_idx" ON "public"."driver_credit_allocation"("movement_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_payment_batch_idempotency_key_key" ON "public"."delivery_payment_batch"("idempotency_key");

-- CreateIndex
CREATE INDEX "delivery_payment_batch_route_sheet_detail_id_idx" ON "public"."delivery_payment_batch"("route_sheet_detail_id");

-- CreateIndex
CREATE UNIQUE INDEX "driver_expense_idempotency_key_key" ON "public"."driver_expense"("idempotency_key");

-- CreateIndex
CREATE INDEX "driver_expense_route_sheet_id_idx" ON "public"."driver_expense"("route_sheet_id");

-- CreateIndex
CREATE INDEX "driver_expense_driver_id_created_at_idx" ON "public"."driver_expense"("driver_id", "created_at");

-- CreateIndex
CREATE INDEX "delivery_quantity_edit_route_sheet_detail_id_idx" ON "public"."delivery_quantity_edit"("route_sheet_detail_id");

-- AddForeignKey
ALTER TABLE "public"."driver_credit_charge" ADD CONSTRAINT "driver_credit_charge_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."driver_credit_charge" ADD CONSTRAINT "driver_credit_charge_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."person"("person_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."driver_credit_charge" ADD CONSTRAINT "driver_credit_charge_route_sheet_detail_id_fkey" FOREIGN KEY ("route_sheet_detail_id") REFERENCES "public"."route_sheet_detail"("route_sheet_detail_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."driver_credit_charge" ADD CONSTRAINT "driver_credit_charge_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transaction"("transaction_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."driver_credit_allocation" ADD CONSTRAINT "driver_credit_allocation_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "public"."driver_credit_charge"("charge_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."driver_credit_allocation" ADD CONSTRAINT "driver_credit_allocation_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "public"."driver_account_movement"("movement_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."delivery_payment_batch" ADD CONSTRAINT "delivery_payment_batch_route_sheet_detail_id_fkey" FOREIGN KEY ("route_sheet_detail_id") REFERENCES "public"."route_sheet_detail"("route_sheet_detail_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."delivery_payment_batch" ADD CONSTRAINT "delivery_payment_batch_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."driver_expense" ADD CONSTRAINT "driver_expense_route_sheet_id_fkey" FOREIGN KEY ("route_sheet_id") REFERENCES "public"."route_sheet"("route_sheet_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."driver_expense" ADD CONSTRAINT "driver_expense_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."driver_expense" ADD CONSTRAINT "driver_expense_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."delivery_quantity_edit" ADD CONSTRAINT "delivery_quantity_edit_route_sheet_detail_id_fkey" FOREIGN KEY ("route_sheet_detail_id") REFERENCES "public"."route_sheet_detail"("route_sheet_detail_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."delivery_quantity_edit" ADD CONSTRAINT "delivery_quantity_edit_enabled_by_fkey" FOREIGN KEY ("enabled_by") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Métodos de pago de cuenta corriente para el cobro en ruta. El id se calcula a
-- mano porque el seed carga ids fijos (1 a 5) sin avanzar la secuencia; nunca
-- se usa un id menor a 6 para no pisar los del seed en una base nueva.
INSERT INTO "public"."payment_method" ("payment_method_id", "code", "description")
SELECT GREATEST(COALESCE(MAX("payment_method_id"), 0), 5) + 1, 'CTA_CTE_CHOFER', 'Cuenta corriente del chofer'
FROM "public"."payment_method"
WHERE NOT EXISTS (SELECT 1 FROM "public"."payment_method" WHERE "code" = 'CTA_CTE_CHOFER');

INSERT INTO "public"."payment_method" ("payment_method_id", "code", "description")
SELECT GREATEST(COALESCE(MAX("payment_method_id"), 0), 5) + 1, 'CTA_CTE_CLIENTE', 'Cuenta corriente del cliente'
FROM "public"."payment_method"
WHERE NOT EXISTS (SELECT 1 FROM "public"."payment_method" WHERE "code" = 'CTA_CTE_CLIENTE');

SELECT setval(
  pg_get_serial_sequence('"public"."payment_method"', 'payment_method_id'),
  GREATEST((SELECT COALESCE(MAX("payment_method_id"), 1) FROM "public"."payment_method"), 1)
);
