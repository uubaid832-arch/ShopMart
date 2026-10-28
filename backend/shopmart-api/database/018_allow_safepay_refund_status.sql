BEGIN;

-- Safepay Sandbox orders use payment_method='DEMO'. Allow their normal refund
-- states while retaining the existing DEMO_VOID rule for cancelled orders.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_demo_payment_valid;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_demo_payment_valid CHECK (
    (
      payment_method = 'DEMO'
      AND (
        (status = 'CANCELLED' AND payment_status = 'DEMO_VOID')
        OR
        (status <> 'CANCELLED' AND payment_status IN (
          'DEMO_PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'
        ))
      )
    )
    OR
    (
      payment_method <> 'DEMO'
      AND payment_status NOT IN ('DEMO_PAID', 'DEMO_VOID')
    )
  );

COMMIT;
