BEGIN;

-- Run before deploying the backend that stops writing public return numbers.
-- This keeps a rolling deployment compatible while the old and new versions overlap.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'return_requests'
      AND column_name = 'return_number'
  ) THEN
    ALTER TABLE public.return_requests
      ALTER COLUMN return_number DROP NOT NULL;
  END IF;
END $$;

COMMIT;
