BEGIN;
SET LOCAL ROLE shopmart_app;

-- One queued email per newly created in-app notification. No old history is backfilled.
CREATE TABLE IF NOT EXISTS public.activity_email_outbox (
    notification_id UUID PRIMARY KEY REFERENCES public.notifications(id) ON DELETE CASCADE,
    state VARCHAR(12) NOT NULL DEFAULT 'PENDING'
        CHECK (state IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMPTZ,
    last_error VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS activity_email_pending_idx
    ON public.activity_email_outbox(next_attempt_at) WHERE state = 'PENDING';

CREATE OR REPLACE FUNCTION public.queue_notification_email()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    INSERT INTO public.activity_email_outbox(notification_id) VALUES (NEW.id)
    ON CONFLICT (notification_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notification_email_queue ON public.notifications;
CREATE TRIGGER notification_email_queue AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.queue_notification_email();

-- Returns/refunds did not previously create notifications for every transition.
-- Add them here so both the in-app list and email use the same event.
CREATE OR REPLACE FUNCTION public.notify_return_activity()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
    target_order UUID;
    target_customer UUID;
    number TEXT;
    event TEXT;
    heading TEXT;
    detail TEXT;
BEGIN
    SELECT o.id, o.user_id, o.order_number INTO target_order, target_customer, number
    FROM public.order_items i JOIN public.orders o ON o.id = i.order_id
    WHERE i.id = NEW.order_item_id;

    IF TG_OP = 'INSERT' THEN
        event := 'RETURN_REQUESTED:' || NEW.id;
        heading := 'Return request submitted';
        detail := 'A return request for order ' || number || ' has been submitted.';
    ELSIF NEW.refund_status IS DISTINCT FROM OLD.refund_status
          AND NEW.refund_status = 'REFUNDED' THEN
        event := 'RETURN_REFUNDED:' || NEW.id;
        heading := 'Refund recorded';
        detail := 'A refund of PKR ' || NEW.refund_amount::TEXT
            || ' has been recorded for order ' || number || '.';
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        event := 'RETURN_STATUS:' || NEW.id || ':' || NEW.status;
        heading := 'Return request update';
        detail := 'The return request for order ' || number || ' is now '
            || lower(NEW.status) || '.';
    ELSE
        RETURN NEW;
    END IF;

    INSERT INTO public.notifications(user_id, event_key, type, title, message, order_id)
    SELECT u.id, event, 'RETURN_UPDATE', heading, detail, target_order
    FROM public.users u
    WHERE u.enabled = TRUE AND (u.id = target_customer OR u.role = 'ADMIN')
    ON CONFLICT (user_id, event_key) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS return_activity_notification ON public.return_requests;
CREATE TRIGGER return_activity_notification
AFTER INSERT OR UPDATE ON public.return_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_return_activity();

COMMIT;
