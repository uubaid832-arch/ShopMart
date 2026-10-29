BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.order_public_number_seq;
CREATE SEQUENCE IF NOT EXISTS public.return_public_number_seq;

-- Preserve the internal UUID primary keys. Give customers short, stable
-- references for existing orders that currently expose their full UUID.
WITH current_numbers AS (
  SELECT COALESCE(MAX(substring(order_number FROM 4)::BIGINT), 0) AS last_number
  FROM public.orders
  WHERE order_number ~ '^SM-[0-9]{1,18}$'
), to_shorten AS (
  SELECT o.id,
         current_numbers.last_number
           + ROW_NUMBER() OVER (ORDER BY o.created_at, o.id) AS public_number
  FROM public.orders o
  CROSS JOIN current_numbers
  WHERE o.order_number !~ '^SM-[0-9]{8,}$'
)
UPDATE public.orders o
SET order_number = 'SM-' || CASE
  WHEN LENGTH(to_shorten.public_number::TEXT) < 8
    THEN LPAD(to_shorten.public_number::TEXT, 8, '0')
  ELSE to_shorten.public_number::TEXT
END
FROM to_shorten
WHERE o.id = to_shorten.id;

ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS return_number VARCHAR(20);

WITH current_numbers AS (
  SELECT COALESCE(MAX(substring(return_number FROM 4)::BIGINT), 0) AS last_number
  FROM public.return_requests
  WHERE return_number ~ '^RT-[0-9]{1,18}$'
), numbered AS (
  SELECT r.id,
         current_numbers.last_number
           + ROW_NUMBER() OVER (ORDER BY r.created_at, r.id) AS public_number
  FROM public.return_requests r
  CROSS JOIN current_numbers
  WHERE r.return_number IS NULL
)
UPDATE public.return_requests r
SET return_number = 'RT-' || CASE
  WHEN LENGTH(numbered.public_number::TEXT) < 8
    THEN LPAD(numbered.public_number::TEXT, 8, '0')
  ELSE numbered.public_number::TEXT
END
FROM numbered
WHERE r.id = numbered.id;

ALTER TABLE public.return_requests
  ALTER COLUMN return_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS return_requests_return_number_uidx
  ON public.return_requests(return_number);

SELECT setval(
  'public.order_public_number_seq',
  COALESCE(MAX(public_number), 1),
  COALESCE(MAX(public_number), 0) > 0
)
FROM (
  SELECT substring(order_number FROM 4)::BIGINT AS public_number
  FROM public.orders
  WHERE order_number ~ '^SM-[0-9]{1,18}$'
) numbers;

SELECT setval(
  'public.return_public_number_seq',
  COALESCE(MAX(public_number), 1),
  COALESCE(MAX(public_number), 0) > 0
)
FROM (
  SELECT substring(return_number FROM 4)::BIGINT AS public_number
  FROM public.return_requests
  WHERE return_number ~ '^RT-[0-9]{1,18}$'
) numbers;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shopmart_app') THEN
    GRANT USAGE, SELECT ON SEQUENCE public.order_public_number_seq TO shopmart_app;
    GRANT USAGE, SELECT ON SEQUENCE public.return_public_number_seq TO shopmart_app;
    GRANT SELECT, INSERT, UPDATE ON public.return_requests TO shopmart_app;
  END IF;
END $$;

COMMIT;
