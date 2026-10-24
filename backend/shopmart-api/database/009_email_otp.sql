BEGIN;
SET LOCAL ROLE shopmart_app;

CREATE TABLE IF NOT EXISTS public.email_otp_challenges (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('LOGIN_WEB', 'LOGIN_MOBILE', 'RESET')),
    recipient_key CHAR(64) NOT NULL,
    password_stamp CHAR(64),
    code_digest CHAR(64) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    expires_at TIMESTAMPTZ NOT NULL,
    resend_at TIMESTAMPTZ NOT NULL,
    consumed BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS email_otp_user_idx ON public.email_otp_challenges(user_id);
CREATE INDEX IF NOT EXISTS email_otp_expiry_idx ON public.email_otp_challenges(expires_at);

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
    bucket_key CHAR(64) PRIMARY KEY,
    hits INTEGER NOT NULL,
    window_end TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_rate_expiry_idx ON public.auth_rate_limits(window_end);
COMMIT;
