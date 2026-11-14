BEGIN;

SET LOCAL ROLE shopmart_app;

CREATE SEQUENCE IF NOT EXISTS public.shopmart_order_number_seq
    AS BIGINT
    MINVALUE 1
    START WITH 1;

-- Leave all existing order numbers unchanged. Start the new sequence after
-- any already-existing numbers that use the new SM-<digits> format.
SELECT setval(
    'public.shopmart_order_number_seq',
    COALESCE((
        SELECT MAX(substring(order_number FROM 4)::BIGINT)
        FROM public.orders
        WHERE order_number ~ '^SM-[0-9]+$'
    ), 0) + 1,
    FALSE
);

COMMIT;
