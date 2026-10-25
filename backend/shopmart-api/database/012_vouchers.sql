BEGIN;

CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('FIXED','PERCENT')),
    value NUMERIC(12,2) NOT NULL CHECK (value > 0),
    min_subtotal NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
    max_discount NUMERIC(18,2) CHECK (max_discount > 0),
    usage_limit INTEGER NOT NULL CHECK (usage_limit > 0),
    per_user_limit INTEGER NOT NULL CHECK (per_user_limit > 0 AND per_user_limit <= usage_limit),
    valid_days INTEGER NOT NULL CHECK (valid_days BETWEEN 1 AND 3650),
    expires_at TIMESTAMPTZ NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (kind <> 'PERCENT' OR value <= 99)
);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS voucher_id UUID REFERENCES public.vouchers(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS voucher_code VARCHAR(40);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_amounts_valid;
ALTER TABLE public.orders ADD CONSTRAINT orders_amounts_valid CHECK (
    subtotal > 0 AND shipping_fee >= 0 AND discount_amount >= 0 AND discount_amount < subtotal
    AND total = subtotal + shipping_fee - discount_amount AND total > 0
    AND ((voucher_id IS NULL AND voucher_code IS NULL AND discount_amount = 0)
      OR (voucher_id IS NOT NULL AND voucher_code IS NOT NULL AND discount_amount > 0))
);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_discount_valid;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_discount_valid
    CHECK (discount_amount >= 0 AND discount_amount < unit_price * quantity);
CREATE TABLE IF NOT EXISTS public.voucher_redemptions (
    order_id UUID PRIMARY KEY REFERENCES public.orders(id),
    voucher_id UUID NOT NULL REFERENCES public.vouchers(id),
    user_id UUID NOT NULL REFERENCES public.users(id),
    discount_amount NUMERIC(18,2) NOT NULL CHECK (discount_amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS voucher_redemptions_voucher_user_idx ON public.voucher_redemptions(voucher_id,user_id);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shopmart_app') THEN
    GRANT SELECT, INSERT, UPDATE ON public.vouchers TO shopmart_app;
    GRANT SELECT, INSERT ON public.voucher_redemptions TO shopmart_app;
  END IF;
END $$;
-- No sample vouchers or automatic historical discounts are created.
COMMIT;
