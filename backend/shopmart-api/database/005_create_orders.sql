BEGIN;

SET LOCAL ROLE shopmart_app;

CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(40) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES public.users(id),

    idempotency_key UUID NOT NULL,
    request_hash VARCHAR(64) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    payment_method VARCHAR(20) NOT NULL DEFAULT 'COD',
    payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID',

    recipient_name VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    address_line VARCHAR(500) NOT NULL,
    city VARCHAR(150) NOT NULL,

    currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
    subtotal NUMERIC(18, 2) NOT NULL,
    shipping_fee NUMERIC(18, 2) NOT NULL DEFAULT 0,
    total NUMERIC(18, 2) NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT orders_customer_request_unique
        UNIQUE (user_id, idempotency_key),

    CONSTRAINT orders_request_hash_valid
        CHECK (request_hash ~ '^[0-9a-f]{64}$'),

    CONSTRAINT orders_status_valid
        CHECK (status IN (
            'PENDING', 'CONFIRMED', 'DISPATCHED',
            'DELIVERED', 'RETURNED', 'CANCELLED'
        )),

    CONSTRAINT orders_payment_method_valid
        CHECK (payment_method IN (
            'COD', 'STRIPE', 'JAZZCASH', 'EASYPAISA'
        )),

    CONSTRAINT orders_payment_status_valid
        CHECK (payment_status IN (
            'UNPAID', 'PENDING', 'PAID', 'FAILED',
            'REFUNDED', 'PARTIALLY_REFUNDED'
        )),

    CONSTRAINT orders_amounts_valid
        CHECK (
            subtotal > 0
            AND shipping_fee >= 0
            AND total = subtotal + shipping_fee
        ),

    CONSTRAINT orders_currency_valid CHECK (currency = 'PKR')
);

CREATE INDEX orders_user_created_idx
    ON public.orders(user_id, created_at DESC);

CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id),
    product_id UUID NOT NULL REFERENCES public.products(id),
    product_name VARCHAR(150) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    quantity INTEGER NOT NULL,

    CONSTRAINT order_items_product_unique
        UNIQUE (order_id, product_id),

    CONSTRAINT order_items_price_valid CHECK (unit_price > 0),

    CONSTRAINT order_items_quantity_valid
        CHECK (quantity BETWEEN 1 AND 999)
);

CREATE TABLE public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id),
    status VARCHAR(20) NOT NULL,
    changed_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT order_history_status_valid
        CHECK (status IN (
            'PENDING', 'CONFIRMED', 'DISPATCHED',
            'DELIVERED', 'RETURNED', 'CANCELLED'
        ))
);

CREATE INDEX order_history_order_idx
    ON public.order_status_history(order_id, created_at);

COMMIT;