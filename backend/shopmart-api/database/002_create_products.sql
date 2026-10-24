BEGIN;

SET LOCAL ROLE shopmart_app;

CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.categories(id),
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
    stock INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    illustration VARCHAR(30),
    color VARCHAR(30),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT products_name_not_blank
        CHECK (length(trim(name)) > 0),

    CONSTRAINT products_price_positive
        CHECK (price > 0),

    CONSTRAINT products_stock_nonnegative
        CHECK (stock >= 0),

    CONSTRAINT products_currency_pkr
        CHECK (currency = 'PKR')
);

CREATE INDEX products_category_id_idx
    ON public.products(category_id);

INSERT INTO public.products (
    category_id,
    name,
    description,
    price,
    stock,
    illustration,
    color
)
SELECT
    category.id,
    sample.name,
    sample.description,
    sample.price,
    sample.stock,
    sample.illustration,
    sample.color
FROM (
    VALUES
        (
            'Electronics',
            'Wireless Headphones',
            'Sample product for development.',
            4500.00,
            12,
            'headphones',
            'lavender'
        ),
        (
            'Fashion',
            'Everyday Backpack',
            'Sample product for development.',
            2800.00,
            8,
            'backpack',
            'peach'
        ),
        (
            'Home',
            'Coffee Maker',
            'Sample product for development.',
            14999.00,
            5,
            'coffee',
            'mint'
        ),
        (
            'Home',
            'Desk Lamp',
            'Sample product for development.',
            2200.00,
            0,
            'lamp',
            'sand'
        )
) AS sample (
    category_name,
    name,
    description,
    price,
    stock,
    illustration,
    color
)
JOIN public.categories category
    ON category.name = sample.category_name;

COMMIT;