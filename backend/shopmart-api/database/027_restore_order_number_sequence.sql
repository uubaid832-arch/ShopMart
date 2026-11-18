BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.shopmart_order_number_seq
    AS BIGINT
    MINVALUE 1
    START WITH 1;

-- Resume after existing numeric SM order numbers so the unique order_number
-- constraint cannot collide with orders already in the database.
SELECT setval(
    'public.shopmart_order_number_seq',
    COALESCE((
        SELECT MAX(substring(order_number FROM 4)::BIGINT)
        FROM public.orders
        WHERE order_number ~ '^SM-[0-9]+$'
    ), 0) + 1,
    FALSE
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shopmart_app') THEN
        GRANT USAGE, SELECT ON SEQUENCE public.shopmart_order_number_seq TO shopmart_app;
    END IF;
END
$$;

COMMIT;
