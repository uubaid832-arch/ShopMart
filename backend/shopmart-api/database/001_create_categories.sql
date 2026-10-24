BEGIN;

SET LOCAL ROLE shopmart_app;

CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) NOT NULL,
    parent_id UUID REFERENCES public.categories(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT categories_name_not_blank
        CHECK (length(trim(name)) > 0),

    CONSTRAINT categories_not_own_parent
        CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE UNIQUE INDEX categories_name_unique
    ON public.categories (lower(trim(name)));

INSERT INTO public.categories (name)
VALUES
    ('Electronics'),
    ('Fashion'),
    ('Home');

COMMIT;