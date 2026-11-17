-- CreateEnum
CREATE TYPE "public"."AccountMovementSide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "public"."CustomerAccountAdjustmentKind" AS ENUM ('OPENING_BALANCE', 'MANUAL');

-- CreateTable
CREATE TABLE "public"."customer_account_adjustment" (
    "adjustment_id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "kind" "public"."CustomerAccountAdjustmentKind" NOT NULL,
    "side" "public"."AccountMovementSide" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "movement_date" DATE NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "source_reference" VARCHAR(100),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "voided_by" INTEGER,
    "voided_at" TIMESTAMP(3),
    "void_reason" VARCHAR(255),

    CONSTRAINT "customer_account_adjustment_pkey" PRIMARY KEY ("adjustment_id")
);

-- CreateIndex
CREATE INDEX "customer_account_adjustment_customer_id_movement_date_idx" ON "public"."customer_account_adjustment"("customer_id", "movement_date");

-- AddForeignKey
ALTER TABLE "public"."customer_account_adjustment" ADD CONSTRAINT "customer_account_adjustment_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."person"("person_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."customer_account_adjustment" ADD CONSTRAINT "customer_account_adjustment_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."customer_account_adjustment" ADD CONSTRAINT "customer_account_adjustment_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

