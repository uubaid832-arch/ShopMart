CREATE TABLE IF NOT EXISTS public.store_settings (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    warehouse_return_address TEXT NOT NULL DEFAULT '',
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.store_settings (id, warehouse_return_address)
VALUES (1, '')
ON CONFLICT (id) DO NOTHING;
