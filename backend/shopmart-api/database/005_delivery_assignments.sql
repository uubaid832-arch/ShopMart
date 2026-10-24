BEGIN;

SET LOCAL ROLE shopmart_app;

CREATE TABLE public.delivery_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL UNIQUE
        REFERENCES public.orders(id),

    rider_id UUID NOT NULL
        REFERENCES public.users(id),

    assigned_by UUID NOT NULL
        REFERENCES public.users(id),

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX delivery_assignments_rider_idx
    ON public.delivery_assignments(rider_id);

COMMIT;