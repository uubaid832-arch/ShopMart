BEGIN;

SET LOCAL ROLE shopmart_app;

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,

    event_key VARCHAR(200) NOT NULL,
    type VARCHAR(40) NOT NULL,

    title VARCHAR(150) NOT NULL
        CHECK (length(trim(title)) > 0),

    message VARCHAR(1000) NOT NULL
        CHECK (length(trim(message)) > 0),

    order_id UUID REFERENCES public.orders(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMPTZ,

    UNIQUE (user_id, event_key)
);

CREATE INDEX notifications_user_created_idx
    ON public.notifications(user_id, created_at DESC);

CREATE INDEX notifications_unread_idx
    ON public.notifications(user_id)
    WHERE read_at IS NULL;

COMMIT;