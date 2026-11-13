BEGIN;

-- Bank transfers are recorded as pending until a receipt is checked.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_method_valid;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_valid CHECK (
    payment_method IN (
      'COD', 'STRIPE', 'JAZZCASH', 'EASYPAISA', 'DEMO', 'BANK_TRANSFER'
    )
  );

COMMIT;
