BEGIN;
-- One immutable amount per return. An uncertain attempt blocks the entire order.
CREATE TABLE public.safepay_refund_attempts (
 return_id UUID PRIMARY KEY REFERENCES public.return_requests(id),
 order_id UUID NOT NULL REFERENCES public.orders(id),
 admin_id UUID NOT NULL REFERENCES public.users(id),
 tracker VARCHAR(120) NOT NULL REFERENCES public.safepay_sessions(tracker),
 amount_minor BIGINT NOT NULL CHECK(amount_minor > 0),
 state VARCHAR(20) NOT NULL CHECK(state IN ('PROCESSING','REVIEW','CONFIRMED')),
 provider_state VARCHAR(40),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX safepay_one_unresolved_refund ON public.safepay_refund_attempts(order_id)
 WHERE state IN ('PROCESSING','REVIEW');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='shopmart_app') THEN
  GRANT SELECT,INSERT,UPDATE ON public.safepay_refund_attempts TO shopmart_app;
 END IF;
END $$;
COMMIT;
