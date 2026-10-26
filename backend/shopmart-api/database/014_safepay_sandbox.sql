BEGIN;
CREATE TABLE IF NOT EXISTS public.safepay_sessions (
 id UUID PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES public.users(id),
 request_hash VARCHAR(64) NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 order_payload TEXT NOT NULL,
 amount_minor BIGINT NOT NULL CHECK(amount_minor>0),
 merchant_key TEXT NOT NULL,
 source VARCHAR(10) NOT NULL DEFAULT 'web' CHECK(source IN ('web','mobile')),
 tracker VARCHAR(120) NOT NULL UNIQUE,
 checkout_url TEXT NOT NULL,
 state VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','PAID','REVIEW','CANCELLED','REFUNDED')),
 order_id UUID UNIQUE REFERENCES public.orders(id),
 provider_state VARCHAR(40),
 next_check_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(state<>'PAID' OR order_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS safepay_pending_idx ON public.safepay_sessions(next_check_at) WHERE state='PENDING';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='shopmart_app') THEN
   GRANT SELECT,INSERT,UPDATE ON public.safepay_sessions TO shopmart_app;
 END IF;
END $$;
COMMIT;
