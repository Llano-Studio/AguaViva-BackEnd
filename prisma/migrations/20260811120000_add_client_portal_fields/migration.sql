-- ============================================================
-- Migration: add client portal fields
-- Backwards-compatible: password_hash nullable, origen_pedido
-- with default PORTAL_ADMINISTRADOR so existing rows stay valid.
-- ============================================================

-- 1) Enum de origen del pedido
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrigenPedido') THEN
    CREATE TYPE "OrigenPedido" AS ENUM ('PORTAL_CLIENTES', 'PORTAL_ADMINISTRADOR');
  END IF;
END
$$;

-- 2) Campo password_hash en person (nullable para compatibilidad con clientes existentes)
ALTER TABLE "person"
  ADD COLUMN IF NOT EXISTS "password_hash" TEXT;

-- 3) Campo origen_pedido en order_header
ALTER TABLE "order_header"
  ADD COLUMN IF NOT EXISTS "origen_pedido" "OrigenPedido" NOT NULL DEFAULT 'PORTAL_ADMINISTRADOR';

-- 4) Índice para filtrar pedidos por origen
CREATE INDEX IF NOT EXISTS "idx_order_header_origen_pedido"
  ON "order_header" ("origen_pedido");
