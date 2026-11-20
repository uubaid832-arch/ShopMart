BEGIN;

ALTER TABLE public.store_settings
    ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS free_delivery_threshold NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS announcement_messages TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shopmart_app') THEN
        GRANT SELECT, INSERT, UPDATE ON public.store_settings TO shopmart_app;
    END IF;
END
$$;

COMMIT;
