BEGIN;
CREATE TABLE IF NOT EXISTS public.customer_signup_challenges (
 id UUID PRIMARY KEY,
 channel VARCHAR(10) NOT NULL CHECK(channel IN ('WEB','MOBILE')),
 email VARCHAR(254) NOT NULL,
 name VARCHAR(150) NOT NULL,
 password_hash VARCHAR(255) NOT NULL,
 code_digest VARCHAR(64) NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 expires_at TIMESTAMPTZ NOT NULL,
 resend_at TIMESTAMPTZ NOT NULL,
 consumed BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS customer_signup_email_idx ON public.customer_signup_challenges(email,channel);
CREATE INDEX IF NOT EXISTS customer_signup_expiry_idx ON public.customer_signup_challenges(expires_at);
COMMIT;
