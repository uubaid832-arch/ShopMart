BEGIN;

SET LOCAL ROLE shopmart_app;

CREATE OR REPLACE FUNCTION public.keep_latest_50_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    DELETE FROM public.notifications
    WHERE id IN (
        SELECT id
        FROM public.notifications
        WHERE user_id = NEW.user_id
        ORDER BY created_at DESC, id DESC
        OFFSET 50
    );

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notifications_keep_latest_50 ON public.notifications;
CREATE TRIGGER notifications_keep_latest_50
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.keep_latest_50_notifications();

WITH ranked_notifications AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY user_id
               ORDER BY created_at DESC, id DESC
           ) AS position
    FROM public.notifications
)
DELETE FROM public.notifications AS notification
USING ranked_notifications AS ranked
WHERE notification.id = ranked.id
  AND ranked.position > 50;

COMMIT;
