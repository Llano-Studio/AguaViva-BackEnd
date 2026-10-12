-- CreateEnum
CREATE TYPE "public"."RouteSheetExecutionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."RouteSheetPauseReason" AS ENUM ('VEHICLE_ISSUE', 'RESTOCK', 'OTHER');

-- AlterTable
ALTER TABLE "public"."route_sheet" ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "execution_status" "public"."RouteSheetExecutionStatus" NOT NULL DEFAULT 'PLANNED',
ADD COLUMN     "started_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."route_sheet_pause" (
    "pause_id" SERIAL NOT NULL,
    "route_sheet_id" INTEGER NOT NULL,
    "reason" "public"."RouteSheetPauseReason" NOT NULL,
    "notes" TEXT,
    "paused_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paused_by" INTEGER NOT NULL,
    "resumed_at" TIMESTAMP(3),
    "resumed_by" INTEGER,

    CONSTRAINT "route_sheet_pause_pkey" PRIMARY KEY ("pause_id")
);

-- CreateIndex
CREATE INDEX "route_sheet_pause_route_sheet_id_idx" ON "public"."route_sheet_pause"("route_sheet_id");

-- CreateIndex
CREATE INDEX "route_sheet_driver_id_delivery_date_idx" ON "public"."route_sheet"("driver_id", "delivery_date");

-- AddForeignKey
ALTER TABLE "public"."route_sheet_pause" ADD CONSTRAINT "route_sheet_pause_route_sheet_id_fkey" FOREIGN KEY ("route_sheet_id") REFERENCES "public"."route_sheet"("route_sheet_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."route_sheet_pause" ADD CONSTRAINT "route_sheet_pause_paused_by_fkey" FOREIGN KEY ("paused_by") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."route_sheet_pause" ADD CONSTRAINT "route_sheet_pause_resumed_by_fkey" FOREIGN KEY ("resumed_by") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;


-- Hojas ya rendidas por el chofer quedan cerradas
UPDATE "public"."route_sheet"
SET "execution_status" = 'CLOSED', "closed_at" = "reconciliation_at"
WHERE "reconciliation_at" IS NOT NULL;
