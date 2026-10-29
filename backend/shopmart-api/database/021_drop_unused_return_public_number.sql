BEGIN;

-- Apply after the backend without return_number support has been deployed.
DROP INDEX IF EXISTS public.return_requests_return_number_uidx;
ALTER TABLE public.return_requests
  DROP COLUMN IF EXISTS return_number;
DROP SEQUENCE IF EXISTS public.return_public_number_seq;

COMMIT;
