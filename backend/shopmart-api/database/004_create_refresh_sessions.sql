BEGIN;

SET LOCAL ROLE shopmart_app;

CREATE TABLE public.refresh_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    family_id UUID NOT NULL DEFAULT gen_random_uuid(),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by UUID REFERENCES public.refresh_sessions(id),

    CONSTRAINT refresh_token_hash_valid
        CHECK (token_hash ~ '^[0-9a-f]{64}$'),

    CONSTRAINT refresh_expiry_valid
        CHECK (expires_at > created_at),

    CONSTRAINT refresh_replacement_valid
        CHECK (
            replaced_by IS NULL
            OR (
                replaced_by <> id
                AND revoked_at IS NOT NULL
            )
        )
);

CREATE INDEX refresh_sessions_user_idx
    ON public.refresh_sessions(user_id);

CREATE INDEX refresh_sessions_family_idx
    ON public.refresh_sessions(family_id);

CREATE INDEX refresh_sessions_expiry_idx
    ON public.refresh_sessions(expires_at);

COMMIT;