BEGIN;

SET LOCAL ROLE shopmart_app;

CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(32),
    role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT users_name_not_blank
        CHECK (length(trim(name)) > 0),

    CONSTRAINT users_email_normalized
        CHECK (
            email = lower(trim(email))
            AND length(email) > 0
        ),

    CONSTRAINT users_password_hash_not_blank
        CHECK (length(trim(password_hash)) > 0),

    CONSTRAINT users_role_valid
        CHECK (role IN ('CUSTOMER', 'ADMIN', 'RIDER')),

    CONSTRAINT users_email_unique
        UNIQUE (email)
);

COMMIT;