BEGIN;

-- Deletion is restricted in the application to disabled, unreferenced users
-- and disabled vouchers without redemptions. These grants support those APIs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shopmart_app') THEN
    GRANT DELETE ON public.users TO shopmart_app;
    GRANT DELETE ON public.vouchers TO shopmart_app;
  END IF;
END $$;

COMMIT;
