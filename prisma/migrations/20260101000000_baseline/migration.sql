-- Baseline: esquema de la base anterior a las migraciones versionadas.
-- En bases existentes NO se ejecuta: se marca como aplicada con
--   npx prisma migrate resolve --applied 20260101000000_baseline

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('DRIVERS', 'ADMINISTRATIVE', 'SUPERADMIN', 'BOSSADMINISTRATIVE');

-- CreateEnum
CREATE TYPE "public"."OrderType" AS ENUM ('SUBSCRIPTION', 'ONE_OFF', 'CONTRACT_DELIVERY', 'HYBRID');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PREPARATION', 'READY_FOR_DELIVERY', 'IN_DELIVERY', 'DELIVERED', 'RETIRADO', 'CANCELLED', 'REFUNDED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."PersonType" AS ENUM ('INDIVIDUAL', 'PLAN', 'PROSPECT');

-- CreateEnum
CREATE TYPE "public"."ContractStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'PENDING_ACTIVATION', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "public"."ComodatoStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RETURNED', 'DAMAGED', 'LOST');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CREDITED');

-- CreateEnum
CREATE TYPE "public"."PaymentMode" AS ENUM ('ADVANCE', 'ARREARS');

-- CreateEnum
CREATE TYPE "public"."CancellationOrderStatus" AS ENUM ('PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'RESCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."RecoveryStatus" AS ENUM ('PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'RESCHEDULED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "centralUserId" INTEGER,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'SUPERADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isEmailConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "emailConfirmationToken" TEXT,
    "emailTokenExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "recoveryToken" TEXT,
    "recoveryTokenExpires" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RefreshToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."country" (
    "country_id" SMALLSERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "country_pkey" PRIMARY KEY ("country_id")
);

-- CreateTable
CREATE TABLE "public"."province" (
    "province_id" SMALLSERIAL NOT NULL,
    "country_id" SMALLINT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "province_pkey" PRIMARY KEY ("province_id")
);

-- CreateTable
CREATE TABLE "public"."locality" (
    "locality_id" SMALLSERIAL NOT NULL,
    "province_id" SMALLINT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "locality_pkey" PRIMARY KEY ("locality_id")
);

-- CreateTable
CREATE TABLE "public"."zone" (
    "zone_id" SMALLSERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "locality_id" SMALLINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "zone_pkey" PRIMARY KEY ("zone_id")
);

-- CreateTable
CREATE TABLE "public"."product_category" (
    "category_id" SMALLSERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "product_category_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "public"."product" (
    "product_id" SERIAL NOT NULL,
    "category_id" SMALLINT NOT NULL,
    "description" VARCHAR(100) NOT NULL,
    "volume_liters" DECIMAL(5,2),
    "price" DECIMAL(10,2) NOT NULL,
    "is_returnable" BOOLEAN NOT NULL,
    "serial_number" VARCHAR(50),
    "notes" TEXT,
    "image_url" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "public"."price_list" (
    "price_list_id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "effective_date" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" VARCHAR(255),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "price_list_pkey" PRIMARY KEY ("price_list_id")
);

-- CreateTable
CREATE TABLE "public"."price_list_item" (
    "price_list_item_id" SERIAL NOT NULL,
    "price_list_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "price_list_item_pkey" PRIMARY KEY ("price_list_item_id")
);

-- CreateTable
CREATE TABLE "public"."price_list_history" (
    "history_id" SERIAL NOT NULL,
    "price_list_item_id" INTEGER NOT NULL,
    "previous_price" DECIMAL(10,2) NOT NULL,
    "new_price" DECIMAL(10,2) NOT NULL,
    "change_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "change_percentage" DECIMAL(10,2),
    "change_reason" TEXT,
    "created_by" VARCHAR(100),

    CONSTRAINT "price_list_history_pkey" PRIMARY KEY ("history_id")
);

-- CreateTable
CREATE TABLE "public"."warehouse" (
    "warehouse_id" SMALLSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "locality_id" SMALLINT,

    CONSTRAINT "warehouse_pkey" PRIMARY KEY ("warehouse_id")
);

-- CreateTable
CREATE TABLE "public"."inventory" (
    "warehouse_id" SMALLINT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("warehouse_id","product_id")
);

-- CreateTable
CREATE TABLE "public"."movement_type" (
    "movement_type_id" SMALLSERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "description" VARCHAR(100) NOT NULL,

    CONSTRAINT "movement_type_pkey" PRIMARY KEY ("movement_type_id")
);

-- CreateTable
CREATE TABLE "public"."stock_movement" (
    "stock_movement_id" SERIAL NOT NULL,
    "movement_date" TIMESTAMP(6) NOT NULL,
    "movement_type_id" SMALLINT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "source_warehouse_id" SMALLINT,
    "destination_warehouse_id" SMALLINT,
    "quantity" INTEGER NOT NULL,
    "remarks" TEXT,
    "order_id" INTEGER,
    "reference_document" VARCHAR(50),
    "user_id" INTEGER,

    CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("stock_movement_id")
);

-- CreateTable
CREATE TABLE "public"."person" (
    "person_id" SERIAL NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "additional_phones" VARCHAR(200),
    "secondary_phone" VARCHAR(20),
    "name" VARCHAR(100),
    "tax_id" VARCHAR(20),
    "address" VARCHAR(200),
    "locality_id" SMALLINT,
    "zone_id" SMALLINT,
    "registration_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "type" "public"."PersonType" NOT NULL,
    "alias" VARCHAR(100),
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "owns_returnable_containers" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "person_pkey" PRIMARY KEY ("person_id")
);

-- CreateTable
CREATE TABLE "public"."client_contract" (
    "contract_id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "price_list_id" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "notes" TEXT,
    "status" "public"."ContractStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "client_contract_pkey" PRIMARY KEY ("contract_id")
);

-- CreateTable
CREATE TABLE "public"."contract_delivery_schedule" (
    "schedule_id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "scheduled_time" TIME(6) NOT NULL,

    CONSTRAINT "contract_delivery_schedule_pkey" PRIMARY KEY ("schedule_id")
);

-- CreateTable
CREATE TABLE "public"."subscription_plan" (
    "subscription_plan_id" SMALLSERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2),
    "type" "public"."PersonType" NOT NULL DEFAULT 'PLAN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "default_cycle_days" INTEGER NOT NULL DEFAULT 30,
    "default_deliveries_per_cycle" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plan_pkey" PRIMARY KEY ("subscription_plan_id")
);

-- CreateTable
CREATE TABLE "public"."subscription_plan_product" (
    "spp_id" SERIAL NOT NULL,
    "subscription_plan_id" SMALLINT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_quantity" INTEGER NOT NULL,

    CONSTRAINT "subscription_plan_product_pkey" PRIMARY KEY ("spp_id")
);

-- CreateTable
CREATE TABLE "public"."customer_subscription" (
    "subscription_id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "subscription_plan_id" SMALLINT NOT NULL,
    "start_date" DATE NOT NULL,
    "collection_day" SMALLINT,
    "payment_mode" "public"."PaymentMode" NOT NULL DEFAULT 'ADVANCE',
    "payment_due_day" SMALLINT,
    "status" "public"."SubscriptionStatus" NOT NULL,
    "notes" TEXT,
    "cancellation_reason" TEXT,
    "cancellation_date" DATE,
    "collection_scheduled_date" DATE,
    "collection_completed" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "customer_subscription_pkey" PRIMARY KEY ("subscription_id")
);

-- CreateTable
CREATE TABLE "public"."subscription_cycle" (
    "cycle_id" SERIAL NOT NULL,
    "subscription_id" INTEGER NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "cycle_start" DATE NOT NULL,
    "cycle_end" DATE NOT NULL,
    "payment_due_date" DATE,
    "is_overdue" BOOLEAN NOT NULL DEFAULT false,
    "late_fee_applied" BOOLEAN NOT NULL DEFAULT false,
    "late_fee_percentage" DECIMAL(5,2),
    "notes" TEXT,
    "total_amount" DECIMAL(10,2),
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pending_balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "credit_balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "subscription_cycle_pkey" PRIMARY KEY ("cycle_id")
);

-- CreateTable
CREATE TABLE "public"."subscription_cycle_detail" (
    "cycle_detail_id" SERIAL NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "planned_quantity" INTEGER NOT NULL,
    "delivered_quantity" INTEGER NOT NULL DEFAULT 0,
    "remaining_balance" INTEGER NOT NULL,

    CONSTRAINT "subscription_cycle_detail_pkey" PRIMARY KEY ("cycle_detail_id")
);

-- CreateTable
CREATE TABLE "public"."subscription_delivery_schedule" (
    "schedule_id" SERIAL NOT NULL,
    "subscription_id" INTEGER NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "scheduled_time" VARCHAR(20) NOT NULL,

    CONSTRAINT "subscription_delivery_schedule_pkey" PRIMARY KEY ("schedule_id")
);

-- CreateTable
CREATE TABLE "public"."sale_channel" (
    "sale_channel_id" SMALLSERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "description" VARCHAR(100) NOT NULL,

    CONSTRAINT "sale_channel_pkey" PRIMARY KEY ("sale_channel_id")
);

-- CreateTable
CREATE TABLE "public"."order_header" (
    "order_id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "contract_id" INTEGER,
    "sale_channel_id" SMALLINT NOT NULL DEFAULT 1,
    "order_date" TIMESTAMP(6) NOT NULL,
    "scheduled_delivery_date" TIMESTAMP(6),
    "delivery_time" VARCHAR(20),
    "total_amount" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL,
    "order_type" "public"."OrderType" NOT NULL,
    "status" "public"."OrderStatus" NOT NULL,
    "payment_status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "subscription_id" INTEGER,
    "zone_id" SMALLINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "order_header_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "public"."ordenes_de_cobranza" (
    "collection_order_id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "contract_id" INTEGER,
    "sale_channel_id" SMALLINT NOT NULL DEFAULT 1,
    "order_date" TIMESTAMP(6) NOT NULL,
    "scheduled_delivery_date" TIMESTAMP(6),
    "delivery_time" VARCHAR(20),
    "total_amount" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL,
    "order_type" "public"."OrderType" NOT NULL,
    "status" "public"."OrderStatus" NOT NULL,
    "payment_status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "subscription_id" INTEGER,
    "zone_id" SMALLINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "es_automatica" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ordenes_de_cobranza_pkey" PRIMARY KEY ("collection_order_id")
);

-- CreateTable
CREATE TABLE "public"."collection_order_item" (
    "collection_order_item_id" SERIAL NOT NULL,
    "collection_order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "price_list_id" INTEGER,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "delivered_quantity" INTEGER DEFAULT 0,
    "returned_quantity" INTEGER DEFAULT 0,

    CONSTRAINT "collection_order_item_pkey" PRIMARY KEY ("collection_order_item_id")
);

-- CreateTable
CREATE TABLE "public"."collection_payment_transaction" (
    "collection_payment_transaction_id" SERIAL NOT NULL,
    "collection_order_id" INTEGER NOT NULL,
    "payment_method_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "transaction_reference" VARCHAR(100),
    "payment_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "collection_payment_transaction_pkey" PRIMARY KEY ("collection_payment_transaction_id")
);

-- CreateTable
CREATE TABLE "public"."order_item" (
    "order_item_id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "price_list_id" INTEGER,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "delivered_quantity" INTEGER DEFAULT 0,
    "returned_quantity" INTEGER DEFAULT 0,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("order_item_id")
);

-- CreateTable
CREATE TABLE "public"."one_off_purchase" (
    "purchase_id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "purchase_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sale_channel_id" SMALLINT NOT NULL,
    "delivery_address" TEXT,
    "locality_id" SMALLINT,
    "zone_id" SMALLINT,
    "scheduled_delivery_date" TIMESTAMP(6),
    "delivery_time" VARCHAR(50),
    "notes" TEXT,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price_list_id" INTEGER,
    "delivered_quantity" INTEGER DEFAULT 0,
    "requires_delivery" BOOLEAN NOT NULL DEFAULT false,
    "returned_quantity" INTEGER DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "one_off_purchase_pkey" PRIMARY KEY ("purchase_id")
);

-- CreateTable
CREATE TABLE "public"."one_off_purchase_header" (
    "purchase_header_id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "sale_channel_id" SMALLINT NOT NULL,
    "purchase_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "delivery_address" TEXT,
    "locality_id" SMALLINT,
    "zone_id" SMALLINT,
    "price_list_id" INTEGER,
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "payment_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "delivery_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "scheduled_delivery_date" TIMESTAMP(6),
    "delivery_time" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "one_off_purchase_header_pkey" PRIMARY KEY ("purchase_header_id")
);

-- CreateTable
CREATE TABLE "public"."one_off_purchase_item" (
    "purchase_item_id" SERIAL NOT NULL,
    "purchase_header_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "price_list_id" INTEGER,

    CONSTRAINT "one_off_purchase_item_pkey" PRIMARY KEY ("purchase_item_id")
);

-- CreateTable
CREATE TABLE "public"."payment_method" (
    "payment_method_id" SMALLSERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "description" VARCHAR(100) NOT NULL,

    CONSTRAINT "payment_method_pkey" PRIMARY KEY ("payment_method_id")
);

-- CreateTable
CREATE TABLE "public"."payment_transaction" (
    "transaction_id" SERIAL NOT NULL,
    "transaction_date" TIMESTAMP(6) NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "order_id" INTEGER,
    "document_number" VARCHAR(20) NOT NULL,
    "receipt_number" VARCHAR(20),
    "transaction_type" VARCHAR(10) NOT NULL,
    "previous_balance" DECIMAL(10,2) NOT NULL,
    "transaction_amount" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "payment_method_id" SMALLINT NOT NULL DEFAULT 1,
    "notes" TEXT,
    "user_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3),
    "updated_by" INTEGER,

    CONSTRAINT "payment_transaction_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "public"."payment_audit" (
    "audit_id" SERIAL NOT NULL,
    "table_name" VARCHAR(50) NOT NULL,
    "record_id" INTEGER NOT NULL,
    "operation_type" VARCHAR(20) NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "reason" TEXT,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,

    CONSTRAINT "payment_audit_pkey" PRIMARY KEY ("audit_id")
);

-- CreateTable
CREATE TABLE "public"."payment_line" (
    "payment_line_id" SERIAL NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "payment_line_pkey" PRIMARY KEY ("payment_line_id")
);

-- CreateTable
CREATE TABLE "public"."payment_installment" (
    "installment_id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "due_date" TIMESTAMP(6) NOT NULL,
    "delivered_quantity" INTEGER NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "payment_installment_pkey" PRIMARY KEY ("installment_id")
);

-- CreateTable
CREATE TABLE "public"."installment_order_link" (
    "link_id" SERIAL NOT NULL,
    "installment_id" INTEGER NOT NULL,
    "order_id" INTEGER NOT NULL,
    "order_itemOrder_item_id" INTEGER,

    CONSTRAINT "installment_order_link_pkey" PRIMARY KEY ("link_id")
);

-- CreateTable
CREATE TABLE "public"."vehicle" (
    "vehicle_id" SMALLSERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vehicle_pkey" PRIMARY KEY ("vehicle_id")
);

-- CreateTable
CREATE TABLE "public"."vehicle_inventory" (
    "vehicle_id" SMALLINT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity_loaded" INTEGER NOT NULL,
    "quantity_empty" INTEGER,

    CONSTRAINT "vehicle_inventory_pkey" PRIMARY KEY ("vehicle_id","product_id")
);

-- CreateTable
CREATE TABLE "public"."vehicle_zone" (
    "vehicle_zone_id" SERIAL NOT NULL,
    "vehicle_id" SMALLINT NOT NULL,
    "zone_id" SMALLINT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "vehicle_zone_pkey" PRIMARY KEY ("vehicle_zone_id")
);

-- CreateTable
CREATE TABLE "public"."user_vehicle" (
    "user_vehicle_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "vehicle_id" SMALLINT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "user_vehicle_pkey" PRIMARY KEY ("user_vehicle_id")
);

-- CreateTable
CREATE TABLE "public"."route_sheet" (
    "route_sheet_id" SERIAL NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "vehicle_id" SMALLINT NOT NULL,
    "delivery_date" DATE NOT NULL,
    "route_notes" TEXT,
    "driver_reconciliation_signature_path" TEXT,
    "reconciliation_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "route_sheet_pkey" PRIMARY KEY ("route_sheet_id")
);

-- CreateTable
CREATE TABLE "public"."route_sheet_detail" (
    "route_sheet_detail_id" SERIAL NOT NULL,
    "route_sheet_id" INTEGER NOT NULL,
    "order_id" INTEGER,
    "one_off_purchase_id" INTEGER,
    "one_off_purchase_header_id" INTEGER,
    "cancellation_order_id" INTEGER,
    "cycle_payment_id" INTEGER,
    "delivery_status" VARCHAR(20) NOT NULL,
    "delivery_time" VARCHAR(50),
    "comments" TEXT,
    "digital_signature_id" VARCHAR(100),
    "actual_arrival_time" TIMESTAMP(3),
    "delivery_notes" TEXT,
    "estimated_arrival_time" TIMESTAMP(3),
    "lat" DECIMAL(10,8),
    "lng" DECIMAL(10,8),
    "recipient_name" TEXT,
    "rejection_reason" TEXT,
    "reschedule_date" TIMESTAMP(3),
    "sequence_number" INTEGER,

    CONSTRAINT "route_sheet_detail_pkey" PRIMARY KEY ("route_sheet_detail_id")
);

-- CreateTable
CREATE TABLE "public"."route_optimization" (
    "optimization_id" SERIAL NOT NULL,
    "route_sheet_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estimated_duration" INTEGER NOT NULL,
    "estimated_distance" DECIMAL(10,2) NOT NULL,
    "optimization_status" TEXT NOT NULL,
    "waypoints" JSONB,

    CONSTRAINT "route_optimization_pkey" PRIMARY KEY ("optimization_id")
);

-- CreateTable
CREATE TABLE "public"."vehicle_route_inventory" (
    "inventory_id" SERIAL NOT NULL,
    "route_sheet_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "initial_quantity" INTEGER NOT NULL,
    "current_quantity" INTEGER NOT NULL,
    "returned_quantity" INTEGER NOT NULL,

    CONSTRAINT "vehicle_route_inventory_pkey" PRIMARY KEY ("inventory_id")
);

-- CreateTable
CREATE TABLE "public"."inventory_transaction" (
    "transaction_id" SERIAL NOT NULL,
    "route_sheet_id" INTEGER NOT NULL,
    "detail_id" INTEGER,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transaction_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "public"."delivery_evidence" (
    "evidence_id" SERIAL NOT NULL,
    "route_sheet_detail_id" INTEGER NOT NULL,
    "evidence_type" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,

    CONSTRAINT "delivery_evidence_pkey" PRIMARY KEY ("evidence_id")
);

-- CreateTable
CREATE TABLE "public"."delivery_incident" (
    "incident_id" SERIAL NOT NULL,
    "route_sheet_detail_id" INTEGER NOT NULL,
    "incident_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "resolution" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" INTEGER,

    CONSTRAINT "delivery_incident_pkey" PRIMARY KEY ("incident_id")
);

-- CreateTable
CREATE TABLE "public"."delivery_stats" (
    "stat_id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "driver_id" INTEGER,
    "vehicle_id" INTEGER,
    "zone_id" SMALLINT,
    "route_sheet_id" INTEGER,
    "total_deliveries" INTEGER NOT NULL,
    "completed_deliveries" INTEGER NOT NULL,
    "rejected_deliveries" INTEGER NOT NULL,
    "rescheduled_deliveries" INTEGER NOT NULL,
    "avg_delivery_time" INTEGER,
    "avg_delay_time" INTEGER,

    CONSTRAINT "delivery_stats_pkey" PRIMARY KEY ("stat_id")
);

-- CreateTable
CREATE TABLE "public"."cycle_payment" (
    "payment_id" SERIAL NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method" VARCHAR(50) NOT NULL,
    "reference" VARCHAR(100),
    "notes" TEXT,
    "created_by" INTEGER,
    "updated_at" TIMESTAMP(3),
    "updated_by" INTEGER,

    CONSTRAINT "cycle_payment_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "public"."cancellation_order" (
    "cancellation_order_id" SERIAL NOT NULL,
    "subscription_id" INTEGER NOT NULL,
    "scheduled_collection_date" DATE NOT NULL,
    "actual_collection_date" DATE,
    "status" "public"."CancellationOrderStatus" NOT NULL DEFAULT 'PENDING',
    "route_sheet_id" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "rescheduled_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cancellation_order_pkey" PRIMARY KEY ("cancellation_order_id")
);

-- CreateTable
CREATE TABLE "public"."comodato" (
    "comodato_id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "subscription_id" INTEGER,
    "quantity" INTEGER NOT NULL,
    "max_quantity" INTEGER,
    "delivery_date" DATE NOT NULL,
    "return_date" DATE,
    "expected_return_date" DATE,
    "status" "public"."ComodatoStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "deposit_amount" DECIMAL(10,2),
    "monthly_fee" DECIMAL(10,2),
    "article_description" VARCHAR(255),
    "brand" VARCHAR(100),
    "model" VARCHAR(100),
    "contract_image_path" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "comodato_pkey" PRIMARY KEY ("comodato_id")
);

-- CreateTable
CREATE TABLE "public"."recovery_order" (
    "recovery_order_id" SERIAL NOT NULL,
    "comodato_id" INTEGER NOT NULL,
    "scheduled_recovery_date" DATE NOT NULL,
    "actual_recovery_date" DATE,
    "status" "public"."RecoveryStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recovery_order_pkey" PRIMARY KEY ("recovery_order_id")
);

-- CreateTable
CREATE TABLE "public"."comodato_change" (
    "change_id" SERIAL NOT NULL,
    "comodato_id" INTEGER NOT NULL,
    "change_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "change_reason" TEXT NOT NULL,
    "old_status" "public"."ComodatoStatus",
    "new_status" "public"."ComodatoStatus",
    "changed_by" INTEGER,
    "notes" TEXT,

    CONSTRAINT "comodato_change_pkey" PRIMARY KEY ("change_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_centralUserId_key" ON "public"."User"("centralUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailConfirmationToken_key" ON "public"."User"("emailConfirmationToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_recoveryToken_key" ON "public"."User"("recoveryToken");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "public"."RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "country_code_key" ON "public"."country"("code");

-- CreateIndex
CREATE UNIQUE INDEX "province_code_key" ON "public"."province"("code");

-- CreateIndex
CREATE UNIQUE INDEX "locality_code_key" ON "public"."locality"("code");

-- CreateIndex
CREATE UNIQUE INDEX "zone_locality_id_code_key" ON "public"."zone"("locality_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "zone_locality_id_name_key" ON "public"."zone"("locality_id", "name");

-- CreateIndex
CREATE INDEX "price_list_history_price_list_item_id_idx" ON "public"."price_list_history"("price_list_item_id");

-- CreateIndex
CREATE INDEX "price_list_history_change_date_idx" ON "public"."price_list_history"("change_date");

-- CreateIndex
CREATE UNIQUE INDEX "movement_type_code_key" ON "public"."movement_type"("code");

-- CreateIndex
CREATE UNIQUE INDEX "person_phone_key" ON "public"."person"("phone");

-- CreateIndex
CREATE INDEX "person_name_idx" ON "public"."person"("name");

-- CreateIndex
CREATE INDEX "person_alias_idx" ON "public"."person"("alias");

-- CreateIndex
CREATE INDEX "person_tax_id_idx" ON "public"."person"("tax_id");

-- CreateIndex
CREATE INDEX "customer_subscription_status_idx" ON "public"."customer_subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_cycle_subscription_id_cycle_number_key" ON "public"."subscription_cycle"("subscription_id", "cycle_number");

-- CreateIndex
CREATE UNIQUE INDEX "sale_channel_code_key" ON "public"."sale_channel"("code");

-- CreateIndex
CREATE INDEX "order_header_order_date_idx" ON "public"."order_header"("order_date");

-- CreateIndex
CREATE INDEX "order_header_status_idx" ON "public"."order_header"("status");

-- CreateIndex
CREATE INDEX "ordenes_de_cobranza_order_date_idx" ON "public"."ordenes_de_cobranza"("order_date");

-- CreateIndex
CREATE INDEX "ordenes_de_cobranza_status_idx" ON "public"."ordenes_de_cobranza"("status");

-- CreateIndex
CREATE INDEX "ordenes_de_cobranza_es_automatica_idx" ON "public"."ordenes_de_cobranza"("es_automatica");

-- CreateIndex
CREATE INDEX "ordenes_de_cobranza_customer_id_idx" ON "public"."ordenes_de_cobranza"("customer_id");

-- CreateIndex
CREATE INDEX "collection_order_item_collection_order_id_idx" ON "public"."collection_order_item"("collection_order_id");

-- CreateIndex
CREATE INDEX "collection_order_item_product_id_idx" ON "public"."collection_order_item"("product_id");

-- CreateIndex
CREATE INDEX "collection_order_item_price_list_id_idx" ON "public"."collection_order_item"("price_list_id");

-- CreateIndex
CREATE INDEX "collection_payment_transaction_collection_order_id_idx" ON "public"."collection_payment_transaction"("collection_order_id");

-- CreateIndex
CREATE INDEX "collection_payment_transaction_payment_method_id_idx" ON "public"."collection_payment_transaction"("payment_method_id");

-- CreateIndex
CREATE INDEX "collection_payment_transaction_payment_date_idx" ON "public"."collection_payment_transaction"("payment_date");

-- CreateIndex
CREATE INDEX "order_item_order_id_idx" ON "public"."order_item"("order_id");

-- CreateIndex
CREATE INDEX "order_item_product_id_idx" ON "public"."order_item"("product_id");

-- CreateIndex
CREATE INDEX "order_item_price_list_id_idx" ON "public"."order_item"("price_list_id");

-- CreateIndex
CREATE INDEX "one_off_purchase_status_idx" ON "public"."one_off_purchase"("status");

-- CreateIndex
CREATE INDEX "one_off_purchase_requires_delivery_idx" ON "public"."one_off_purchase"("requires_delivery");

-- CreateIndex
CREATE INDEX "one_off_purchase_header_purchase_date_idx" ON "public"."one_off_purchase_header"("purchase_date");

-- CreateIndex
CREATE INDEX "one_off_purchase_header_scheduled_delivery_date_idx" ON "public"."one_off_purchase_header"("scheduled_delivery_date");

-- CreateIndex
CREATE INDEX "one_off_purchase_header_status_idx" ON "public"."one_off_purchase_header"("status");

-- CreateIndex
CREATE INDEX "one_off_purchase_header_person_id_idx" ON "public"."one_off_purchase_header"("person_id");

-- CreateIndex
CREATE INDEX "one_off_purchase_item_purchase_header_id_idx" ON "public"."one_off_purchase_item"("purchase_header_id");

-- CreateIndex
CREATE INDEX "one_off_purchase_item_product_id_idx" ON "public"."one_off_purchase_item"("product_id");

-- CreateIndex
CREATE INDEX "one_off_purchase_item_price_list_id_idx" ON "public"."one_off_purchase_item"("price_list_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_method_code_key" ON "public"."payment_method"("code");

-- CreateIndex
CREATE INDEX "payment_audit_table_name_record_id_idx" ON "public"."payment_audit"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "payment_audit_created_at_idx" ON "public"."payment_audit"("created_at");

-- CreateIndex
CREATE INDEX "payment_audit_created_by_idx" ON "public"."payment_audit"("created_by");

-- CreateIndex
CREATE INDEX "payment_audit_operation_type_idx" ON "public"."payment_audit"("operation_type");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_code_key" ON "public"."vehicle"("code");

-- CreateIndex
CREATE INDEX "vehicle_zone_vehicle_id_idx" ON "public"."vehicle_zone"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_zone_zone_id_idx" ON "public"."vehicle_zone"("zone_id");

-- CreateIndex
CREATE INDEX "vehicle_zone_is_active_idx" ON "public"."vehicle_zone"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_zone_vehicle_id_zone_id_key" ON "public"."vehicle_zone"("vehicle_id", "zone_id");

-- CreateIndex
CREATE INDEX "user_vehicle_user_id_idx" ON "public"."user_vehicle"("user_id");

-- CreateIndex
CREATE INDEX "user_vehicle_vehicle_id_idx" ON "public"."user_vehicle"("vehicle_id");

-- CreateIndex
CREATE INDEX "user_vehicle_is_active_idx" ON "public"."user_vehicle"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "user_vehicle_user_id_vehicle_id_key" ON "public"."user_vehicle"("user_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "cycle_payment_cycle_id_idx" ON "public"."cycle_payment"("cycle_id");

-- CreateIndex
CREATE INDEX "cycle_payment_payment_date_idx" ON "public"."cycle_payment"("payment_date");

-- CreateIndex
CREATE INDEX "cancellation_order_subscription_id_idx" ON "public"."cancellation_order"("subscription_id");

-- CreateIndex
CREATE INDEX "cancellation_order_scheduled_collection_date_idx" ON "public"."cancellation_order"("scheduled_collection_date");

-- CreateIndex
CREATE INDEX "cancellation_order_status_idx" ON "public"."cancellation_order"("status");

-- CreateIndex
CREATE INDEX "comodato_person_id_idx" ON "public"."comodato"("person_id");

-- CreateIndex
CREATE INDEX "comodato_subscription_id_idx" ON "public"."comodato"("subscription_id");

-- CreateIndex
CREATE INDEX "comodato_status_idx" ON "public"."comodato"("status");

-- CreateIndex
CREATE INDEX "comodato_delivery_date_idx" ON "public"."comodato"("delivery_date");

-- CreateIndex
CREATE INDEX "comodato_is_active_idx" ON "public"."comodato"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_order_comodato_id_key" ON "public"."recovery_order"("comodato_id");

-- CreateIndex
CREATE INDEX "recovery_order_comodato_id_idx" ON "public"."recovery_order"("comodato_id");

-- CreateIndex
CREATE INDEX "recovery_order_scheduled_recovery_date_idx" ON "public"."recovery_order"("scheduled_recovery_date");

-- CreateIndex
CREATE INDEX "recovery_order_status_idx" ON "public"."recovery_order"("status");

-- CreateIndex
CREATE INDEX "comodato_change_comodato_id_idx" ON "public"."comodato_change"("comodato_id");

-- CreateIndex
CREATE INDEX "comodato_change_change_date_idx" ON "public"."comodato_change"("change_date");

-- AddForeignKey
ALTER TABLE "public"."RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."province" ADD CONSTRAINT "fk_province_country" FOREIGN KEY ("country_id") REFERENCES "public"."country"("country_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."locality" ADD CONSTRAINT "fk_locality_province" FOREIGN KEY ("province_id") REFERENCES "public"."province"("province_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."zone" ADD CONSTRAINT "fk_zone_locality" FOREIGN KEY ("locality_id") REFERENCES "public"."locality"("locality_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."product" ADD CONSTRAINT "fk_product_category" FOREIGN KEY ("category_id") REFERENCES "public"."product_category"("category_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."price_list_item" ADD CONSTRAINT "fk_pricelistitem_pricelist" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_list"("price_list_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."price_list_item" ADD CONSTRAINT "fk_pricelistitem_product" FOREIGN KEY ("product_id") REFERENCES "public"."product"("product_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."price_list_history" ADD CONSTRAINT "price_list_history_price_list_item_id_fkey" FOREIGN KEY ("price_list_item_id") REFERENCES "public"."price_list_item"("price_list_item_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."warehouse" ADD CONSTRAINT "fk_warehouse_locality" FOREIGN KEY ("locality_id") REFERENCES "public"."locality"("locality_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inventory" ADD CONSTRAINT "fk_inventory_product" FOREIGN KEY ("product_id") REFERENCES "public"."product"("product_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inventory" ADD CONSTRAINT "fk_inventory_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("warehouse_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."stock_movement" ADD CONSTRAINT "fk_stockmovement_dest_warehouse" FOREIGN KEY ("destination_warehouse_id") REFERENCES "public"."warehouse"("warehouse_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."stock_movement" ADD CONSTRAINT "fk_stockmovement_movement_type" FOREIGN KEY ("movement_type_id") REFERENCES "public"."movement_type"("movement_type_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."stock_movement" ADD CONSTRAINT "fk_stockmovement_product" FOREIGN KEY ("product_id") REFERENCES "public"."product"("product_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."stock_movement" ADD CONSTRAINT "fk_stockmovement_source_warehouse" FOREIGN KEY ("source_warehouse_id") REFERENCES "public"."warehouse"("warehouse_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."stock_movement" ADD CONSTRAINT "stock_movement_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."order_header"("order_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."stock_movement" ADD CONSTRAINT "stock_movement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."person" ADD CONSTRAINT "person_locality_id_fkey" FOREIGN KEY ("locality_id") REFERENCES "public"."locality"("locality_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."person" ADD CONSTRAINT "person_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("zone_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."client_contract" ADD CONSTRAINT "fk_contract_person" FOREIGN KEY ("person_id") REFERENCES "public"."person"("person_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."client_contract" ADD CONSTRAINT "fk_contract_pricelist" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_list"("price_list_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."contract_delivery_schedule" ADD CONSTRAINT "fk_schedule_contract" FOREIGN KEY ("contract_id") REFERENCES "public"."client_contract"("contract_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."subscription_plan_product" ADD CONSTRAINT "fk_spp_plan" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plan"("subscription_plan_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."subscription_plan_product" ADD CONSTRAINT "fk_spp_product" FOREIGN KEY ("product_id") REFERENCES "public"."product"("product_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."customer_subscription" ADD CONSTRAINT "fk_cust_sub_plan" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plan"("subscription_plan_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."customer_subscription" ADD CONSTRAINT "fk_customer_subscription_person" FOREIGN KEY ("customer_id") REFERENCES "public"."person"("person_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."subscription_cycle" ADD CONSTRAINT "fk_cycle_subscription" FOREIGN KEY ("subscription_id") REFERENCES "public"."customer_subscription"("subscription_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."subscription_cycle_detail" ADD CONSTRAINT "fk_cycle_detail_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."subscription_cycle"("cycle_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."subscription_cycle_detail" ADD CONSTRAINT "fk_cycle_detail_product" FOREIGN KEY ("product_id") REFERENCES "public"."product"("product_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."subscription_delivery_schedule" ADD CONSTRAINT "fk_sub_schedule_subscription" FOREIGN KEY ("subscription_id") REFERENCES "public"."customer_subscription"("subscription_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."order_header" ADD CONSTRAINT "fk_order_contract" FOREIGN KEY ("contract_id") REFERENCES "public"."client_contract"("contract_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."order_header" ADD CONSTRAINT "fk_order_salechannel" FOREIGN KEY ("sale_channel_id") REFERENCES "public"."sale_channel"("sale_channel_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."order_header" ADD CONSTRAINT "order_header_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."person"("person_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."order_header" ADD CONSTRAINT "order_header_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."customer_subscription"("subscription_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."order_header" ADD CONSTRAINT "order_header_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("zone_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ordenes_de_cobranza" ADD CONSTRAINT "ordenes_de_cobranza_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."client_contract"("contract_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ordenes_de_cobranza" ADD CONSTRAINT "ordenes_de_cobranza_sale_channel_id_fkey" FOREIGN KEY ("sale_channel_id") REFERENCES "public"."sale_channel"("sale_channel_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ordenes_de_cobranza" ADD CONSTRAINT "ordenes_de_cobranza_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."person"("person_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ordenes_de_cobranza" ADD CONSTRAINT "ordenes_de_cobranza_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."customer_subscription"("subscription_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ordenes_de_cobranza" ADD CONSTRAINT "ordenes_de_cobranza_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("zone_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."collection_order_item" ADD CONSTRAINT "collection_order_item_collection_order_id_fkey" FOREIGN KEY ("collection_order_id") REFERENCES "public"."ordenes_de_cobranza"("collection_order_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."collection_order_item" ADD CONSTRAINT "collection_order_item_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_list"("price_list_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."collection_order_item" ADD CONSTRAINT "collection_order_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("product_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."collection_payment_transaction" ADD CONSTRAINT "collection_payment_transaction_collection_order_id_fkey" FOREIGN KEY ("collection_order_id") REFERENCES "public"."ordenes_de_cobranza"("collection_order_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."collection_payment_transaction" ADD CONSTRAINT "collection_payment_transaction_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_method"("payment_method_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."collection_payment_transaction" ADD CONSTRAINT "collection_payment_transaction_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."collection_payment_transaction" ADD CONSTRAINT "collection_payment_transaction_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."order_item" ADD CONSTRAINT "order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."order_header"("order_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."order_item" ADD CONSTRAINT "order_item_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_list"("price_list_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."order_item" ADD CONSTRAINT "order_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("product_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."one_off_purchase" ADD CONSTRAINT "one_off_purchase_locality_id_fkey" FOREIGN KEY ("locality_id") REFERENCES "public"."locality"("locality_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."one_off_purchase" ADD CONSTRAINT "one_off_purchase_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."person"("person_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."one_off_purchase" ADD CONSTRAINT "one_off_purchase_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_list"("price_list_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."one_off_purchase" ADD CONSTRAINT "one_off_purchase_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("product_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."one_off_purchase" ADD CONSTRAINT "one_off_purchase_sale_channel_id_fkey" FOREIGN KEY ("sale_channel_id") REFERENCES "public"."sale_channel"("sale_channel_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."one_off_purchase" ADD CONSTRAINT "one_off_purchase_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("zone_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."one_off_purchase_header" ADD CONSTRAINT "one_off_purchase_header_locality_id_fkey" FOREIGN KEY ("locality_id") REFERENCES "public"."locality"("locality_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."one_off_purchase_header" ADD CONSTRAINT "one_off_purchase_header_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."person"("person_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."one_off_purchase_header" ADD CONSTRAINT "one_off_purchase_header_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_list"("price_list_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."one_off_purchase_header" ADD CONSTRAINT "one_off_purchase_header_sale_channel_id_fkey" FOREIGN KEY ("sale_channel_id") REFERENCES "public"."sale_channel"("sale_channel_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."one_off_purchase_header" ADD CONSTRAINT "one_off_purchase_header_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("zone_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."one_off_purchase_item" ADD CONSTRAINT "one_off_purchase_item_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_list"("price_list_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."one_off_purchase_item" ADD CONSTRAINT "one_off_purchase_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("product_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."one_off_purchase_item" ADD CONSTRAINT "one_off_purchase_item_purchase_header_id_fkey" FOREIGN KEY ("purchase_header_id") REFERENCES "public"."one_off_purchase_header"("purchase_header_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."payment_transaction" ADD CONSTRAINT "fk_payment_order" FOREIGN KEY ("order_id") REFERENCES "public"."order_header"("order_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."payment_transaction" ADD CONSTRAINT "fk_paymenttrans_paymentmethod" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_method"("payment_method_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."payment_transaction" ADD CONSTRAINT "payment_transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment_transaction" ADD CONSTRAINT "payment_transaction_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment_audit" ADD CONSTRAINT "payment_audit_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment_line" ADD CONSTRAINT "fk_payment_line_product" FOREIGN KEY ("product_id") REFERENCES "public"."product"("product_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."payment_line" ADD CONSTRAINT "fk_payment_line_transaction" FOREIGN KEY ("transaction_id") REFERENCES "public"."payment_transaction"("transaction_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."payment_installment" ADD CONSTRAINT "payment_installment_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."person"("person_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."installment_order_link" ADD CONSTRAINT "fk_installment_order_installment" FOREIGN KEY ("installment_id") REFERENCES "public"."payment_installment"("installment_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."installment_order_link" ADD CONSTRAINT "fk_installment_order_order" FOREIGN KEY ("order_id") REFERENCES "public"."order_header"("order_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."installment_order_link" ADD CONSTRAINT "installment_order_link_order_itemOrder_item_id_fkey" FOREIGN KEY ("order_itemOrder_item_id") REFERENCES "public"."order_item"("order_item_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vehicle_inventory" ADD CONSTRAINT "fk_vehicleinventory_product" FOREIGN KEY ("product_id") REFERENCES "public"."product"("product_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."vehicle_inventory" ADD CONSTRAINT "fk_vehicleinventory_vehicle" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("vehicle_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."vehicle_zone" ADD CONSTRAINT "fk_vehicle_zone_vehicle" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("vehicle_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."vehicle_zone" ADD CONSTRAINT "fk_vehicle_zone_zone" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("zone_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user_vehicle" ADD CONSTRAINT "fk_user_vehicle_user" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user_vehicle" ADD CONSTRAINT "fk_user_vehicle_vehicle" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("vehicle_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."route_sheet" ADD CONSTRAINT "fk_route_driver" FOREIGN KEY ("driver_id") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."route_sheet" ADD CONSTRAINT "fk_route_vehicle" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("vehicle_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."route_sheet_detail" ADD CONSTRAINT "fk_route_detail_order" FOREIGN KEY ("order_id") REFERENCES "public"."order_header"("order_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."route_sheet_detail" ADD CONSTRAINT "route_sheet_detail_one_off_purchase_id_fkey" FOREIGN KEY ("one_off_purchase_id") REFERENCES "public"."one_off_purchase"("purchase_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."route_sheet_detail" ADD CONSTRAINT "route_sheet_detail_one_off_purchase_header_id_fkey" FOREIGN KEY ("one_off_purchase_header_id") REFERENCES "public"."one_off_purchase_header"("purchase_header_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."route_sheet_detail" ADD CONSTRAINT "route_sheet_detail_cancellation_order_id_fkey" FOREIGN KEY ("cancellation_order_id") REFERENCES "public"."cancellation_order"("cancellation_order_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."route_sheet_detail" ADD CONSTRAINT "route_sheet_detail_cycle_payment_id_fkey" FOREIGN KEY ("cycle_payment_id") REFERENCES "public"."cycle_payment"("payment_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."route_sheet_detail" ADD CONSTRAINT "fk_route_detail_route" FOREIGN KEY ("route_sheet_id") REFERENCES "public"."route_sheet"("route_sheet_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."route_optimization" ADD CONSTRAINT "route_optimization_route_sheet_id_fkey" FOREIGN KEY ("route_sheet_id") REFERENCES "public"."route_sheet"("route_sheet_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vehicle_route_inventory" ADD CONSTRAINT "vehicle_route_inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vehicle_route_inventory" ADD CONSTRAINT "vehicle_route_inventory_route_sheet_id_fkey" FOREIGN KEY ("route_sheet_id") REFERENCES "public"."route_sheet"("route_sheet_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_transaction" ADD CONSTRAINT "inventory_transaction_detail_id_fkey" FOREIGN KEY ("detail_id") REFERENCES "public"."route_sheet_detail"("route_sheet_detail_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_transaction" ADD CONSTRAINT "inventory_transaction_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_transaction" ADD CONSTRAINT "inventory_transaction_route_sheet_id_fkey" FOREIGN KEY ("route_sheet_id") REFERENCES "public"."route_sheet"("route_sheet_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_evidence" ADD CONSTRAINT "delivery_evidence_route_sheet_detail_id_fkey" FOREIGN KEY ("route_sheet_detail_id") REFERENCES "public"."route_sheet_detail"("route_sheet_detail_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_incident" ADD CONSTRAINT "delivery_incident_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_incident" ADD CONSTRAINT "delivery_incident_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_incident" ADD CONSTRAINT "delivery_incident_route_sheet_detail_id_fkey" FOREIGN KEY ("route_sheet_detail_id") REFERENCES "public"."route_sheet_detail"("route_sheet_detail_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_stats" ADD CONSTRAINT "delivery_stats_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_stats" ADD CONSTRAINT "delivery_stats_route_sheet_id_fkey" FOREIGN KEY ("route_sheet_id") REFERENCES "public"."route_sheet"("route_sheet_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_stats" ADD CONSTRAINT "delivery_stats_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("vehicle_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_stats" ADD CONSTRAINT "delivery_stats_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("zone_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cycle_payment" ADD CONSTRAINT "cycle_payment_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."subscription_cycle"("cycle_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cycle_payment" ADD CONSTRAINT "cycle_payment_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cycle_payment" ADD CONSTRAINT "cycle_payment_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cancellation_order" ADD CONSTRAINT "cancellation_order_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."customer_subscription"("subscription_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cancellation_order" ADD CONSTRAINT "cancellation_order_route_sheet_id_fkey" FOREIGN KEY ("route_sheet_id") REFERENCES "public"."route_sheet"("route_sheet_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."comodato" ADD CONSTRAINT "comodato_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."person"("person_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."comodato" ADD CONSTRAINT "comodato_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("product_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."comodato" ADD CONSTRAINT "comodato_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."customer_subscription"("subscription_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."recovery_order" ADD CONSTRAINT "recovery_order_comodato_id_fkey" FOREIGN KEY ("comodato_id") REFERENCES "public"."comodato"("comodato_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."comodato_change" ADD CONSTRAINT "comodato_change_comodato_id_fkey" FOREIGN KEY ("comodato_id") REFERENCES "public"."comodato"("comodato_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."comodato_change" ADD CONSTRAINT "comodato_change_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

