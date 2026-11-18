BEGIN;

ALTER TABLE public.store_settings
    ADD COLUMN IF NOT EXISTS operating_cities TEXT[] NOT NULL DEFAULT ARRAY['Lahore']::TEXT[],
    ADD COLUMN IF NOT EXISTS warehouse_address_line TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS warehouse_city TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS warehouse_phone TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(32) NOT NULL DEFAULT '923263101049',
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(120) NOT NULL DEFAULT 'ShopMart Demo Bank (fictional)',
    ADD COLUMN IF NOT EXISTS bank_account_title VARCHAR(120) NOT NULL DEFAULT 'ShopMart Test Store',
    ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(80) NOT NULL DEFAULT '0000 0000 0000',
    ADD COLUMN IF NOT EXISTS bank_iban VARCHAR(80) NOT NULL DEFAULT 'PK00-DEMO-0000-0000-0000';

UPDATE public.store_settings
SET warehouse_address_line = warehouse_return_address
WHERE warehouse_address_line = '' AND warehouse_return_address <> '';

UPDATE public.store_settings
SET warehouse_city = COALESCE(NULLIF(BTRIM(warehouse_city), ''), operating_cities[1], 'Lahore')
WHERE BTRIM(warehouse_city) = '';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shopmart_app') THEN
        GRANT SELECT, INSERT, UPDATE ON public.store_settings TO shopmart_app;
    END IF;
END
$$;

COMMIT;
