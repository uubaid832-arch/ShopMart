BEGIN;

-- Campaigns may be unnamed. Named campaigns power customer promotion banners.
UPDATE public.product_discount_campaigns
SET name = NULL
WHERE name IS NOT NULL AND length(trim(name)) = 0;

ALTER TABLE public.product_discount_campaigns
    ALTER COLUMN name DROP NOT NULL;

ALTER TABLE public.product_discount_campaigns
    DROP CONSTRAINT IF EXISTS product_discount_campaigns_name_check;

ALTER TABLE public.product_discount_campaigns
    ADD CONSTRAINT product_discount_campaigns_name_check
    CHECK (name IS NULL OR length(trim(name)) BETWEEN 1 AND 100);

COMMIT;
