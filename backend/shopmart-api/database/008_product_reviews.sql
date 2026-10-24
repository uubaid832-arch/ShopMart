BEGIN;

SET LOCAL ROLE shopmart_app;

CREATE TABLE public.product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    product_id UUID NOT NULL
        REFERENCES public.products(id),

    user_id UUID NOT NULL
        REFERENCES public.users(id),

    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),

    comment VARCHAR(2000) NOT NULL
        CHECK (length(trim(comment)) > 0),

    is_visible BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (product_id, user_id)
);

CREATE INDEX product_reviews_product_created_idx
    ON public.product_reviews(product_id, created_at DESC);

COMMIT;