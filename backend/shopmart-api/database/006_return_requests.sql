BEGIN;

SET LOCAL ROLE shopmart_app;

CREATE TABLE public.return_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_item_id UUID NOT NULL UNIQUE
        REFERENCES public.order_items(id),

    reason VARCHAR(1000) NOT NULL
        CHECK (length(trim(reason)) > 0),

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED',
                'RECEIVED'
            )
        ),

    refund_amount NUMERIC(18, 2) NOT NULL
        CHECK (refund_amount > 0),

    refund_status VARCHAR(20) NOT NULL DEFAULT 'NOT_INITIATED'
        CHECK (
            refund_status IN (
                'NOT_INITIATED',
                'REFUNDED'
            )
        ),

    reviewed_by UUID REFERENCES public.users(id),
    reviewed_at TIMESTAMPTZ,

    received_by UUID REFERENCES public.users(id),
    received_at TIMESTAMPTZ,

    refunded_by UUID REFERENCES public.users(id),
    refunded_at TIMESTAMPTZ,
    refund_reference VARCHAR(200),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        (status = 'PENDING'
            AND reviewed_by IS NULL
            AND reviewed_at IS NULL)
        OR
        (status <> 'PENDING'
            AND reviewed_by IS NOT NULL
            AND reviewed_at IS NOT NULL)
    ),

    CHECK (
        (status = 'RECEIVED'
            AND received_by IS NOT NULL
            AND received_at IS NOT NULL)
        OR
        (status <> 'RECEIVED'
            AND received_by IS NULL
            AND received_at IS NULL)
    ),

    CHECK (
        (refund_status = 'NOT_INITIATED'
            AND refunded_by IS NULL
            AND refunded_at IS NULL
            AND refund_reference IS NULL)
        OR
        (refund_status = 'REFUNDED'
            AND status = 'RECEIVED'
            AND refunded_by IS NOT NULL
            AND refunded_at IS NOT NULL
            AND length(trim(refund_reference)) > 0
            AND refund_reference IS NOT NULL)
    )
);

CREATE INDEX return_requests_status_idx
    ON public.return_requests(status, created_at DESC);

COMMIT;