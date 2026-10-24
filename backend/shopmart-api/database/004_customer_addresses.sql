BEGIN;

SET LOCAL ROLE shopmart_app;

CREATE TABLE public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,

    label VARCHAR(100) NOT NULL
        CHECK (length(trim(label)) > 0),

    recipient_name VARCHAR(100) NOT NULL
        CHECK (length(trim(recipient_name)) > 0),

    phone VARCHAR(32) NOT NULL
        CHECK (length(trim(phone)) > 0),

    address_line VARCHAR(250) NOT NULL
        CHECK (length(trim(address_line)) > 0),

    city VARCHAR(100) NOT NULL
        CHECK (length(trim(city)) > 0),

    postal_code VARCHAR(20),

    country VARCHAR(100) NOT NULL DEFAULT 'Pakistan'
        CHECK (country = 'Pakistan'),

    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX customer_addresses_user_idx
    ON public.customer_addresses(user_id);

CREATE UNIQUE INDEX customer_addresses_one_default_idx
    ON public.customer_addresses(user_id)
    WHERE is_default = TRUE;

COMMIT;