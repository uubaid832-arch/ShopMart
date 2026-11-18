BEGIN;

CREATE TABLE IF NOT EXISTS public.product_discount_campaigns (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.product_discount_items (
    id UUID PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES public.product_discount_campaigns(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('FIXED','PERCENT')),
    value NUMERIC(12,2) NOT NULL CHECK (value > 0),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (kind <> 'PERCENT' OR value <= 99),
    UNIQUE (campaign_id, product_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_discount_one_active_per_product
    ON public.product_discount_items(product_id)
    WHERE enabled = TRUE;

CREATE INDEX IF NOT EXISTS product_discount_items_campaign_idx
    ON public.product_discount_items(campaign_id, product_id);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_amounts_valid;
ALTER TABLE public.orders ADD CONSTRAINT orders_amounts_valid CHECK (
    subtotal > 0 AND shipping_fee >= 0 AND discount_amount >= 0 AND discount_amount < subtotal
    AND total = subtotal + shipping_fee - discount_amount AND total > 0
    AND ((voucher_id IS NULL AND voucher_code IS NULL)
      OR (voucher_id IS NOT NULL AND voucher_code IS NOT NULL AND discount_amount > 0))
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shopmart_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_discount_campaigns TO shopmart_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_discount_items TO shopmart_app;
  END IF;
END $$;

COMMIT;
