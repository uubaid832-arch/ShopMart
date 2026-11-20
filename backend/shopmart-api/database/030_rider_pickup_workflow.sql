BEGIN;

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_status_valid;
ALTER TABLE public.orders
    ADD CONSTRAINT orders_status_valid
    CHECK (status IN (
        'PENDING', 'CONFIRMED', 'PICKED_UP', 'DISPATCHED',
        'DELIVERED', 'RETURNED', 'CANCELLED'
    ));

ALTER TABLE public.order_status_history
    DROP CONSTRAINT IF EXISTS order_history_status_valid;
ALTER TABLE public.order_status_history
    ADD CONSTRAINT order_history_status_valid
    CHECK (status IN (
        'PENDING', 'CONFIRMED', 'PICKED_UP', 'DISPATCHED',
        'DELIVERED', 'RETURNED', 'CANCELLED'
    ));

COMMIT;
