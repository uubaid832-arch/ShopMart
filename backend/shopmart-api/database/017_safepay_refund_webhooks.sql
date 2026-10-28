BEGIN;
ALTER TABLE public.safepay_refund_attempts ALTER COLUMN admin_id DROP NOT NULL;
ALTER TABLE public.safepay_refund_attempts ADD COLUMN IF NOT EXISTS provider_refund_reference TEXT;
ALTER TABLE public.safepay_refund_attempts ADD COLUMN IF NOT EXISTS evidence_description TEXT;
ALTER TABLE public.safepay_refund_attempts ADD COLUMN IF NOT EXISTS reconciled_by TEXT;
ALTER TABLE public.safepay_refund_attempts ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ;
ALTER TABLE public.return_requests DROP CONSTRAINT IF EXISTS return_inspection_refund_check;
ALTER TABLE public.return_requests ADD CONSTRAINT return_inspection_refund_check CHECK (
 (refund_status='NOT_INITIATED' AND refunded_by IS NULL AND refunded_at IS NULL AND refund_reference IS NULL)
 OR (refund_status='REFUNDED' AND status='APPROVED' AND refunded_at IS NOT NULL
     AND refund_reference IS NOT NULL AND length(trim(refund_reference))>0
     AND (refunded_by IS NOT NULL OR refund_reference LIKE 'evt\_%' ESCAPE '\'))
);
CREATE TABLE public.safepay_webhook_events (
 event_token VARCHAR(120) PRIMARY KEY,
 tracker VARCHAR(120) NOT NULL,
 event_type VARCHAR(80) NOT NULL,
 refund_amount_minor BIGINT NOT NULL CHECK(refund_amount_minor>0),
 balance_minor BIGINT NOT NULL CHECK(balance_minor>=0),
 provider_state VARCHAR(40) NOT NULL,
 received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='shopmart_app') THEN
  GRANT SELECT,INSERT,UPDATE ON public.safepay_refund_attempts TO shopmart_app;
  GRANT SELECT,INSERT ON public.safepay_webhook_events TO shopmart_app;
 END IF;
END $$;
COMMIT;
