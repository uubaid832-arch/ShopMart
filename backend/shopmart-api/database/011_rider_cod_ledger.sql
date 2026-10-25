BEGIN;

CREATE TABLE IF NOT EXISTS public.rider_cod_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id),
  rider_id UUID NOT NULL REFERENCES public.users(id),
  history_id UUID NOT NULL UNIQUE REFERENCES public.order_status_history(id),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'PKR' CHECK (currency = 'PKR'),
  collected_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS rider_cod_collections_rider_idx
  ON public.rider_cod_collections(rider_id, collected_at DESC);

CREATE TABLE IF NOT EXISTS public.rider_cod_handovers (
  id UUID PRIMARY KEY,
  rider_id UUID NOT NULL REFERENCES public.users(id),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'PKR' CHECK (currency = 'PKR'),
  note VARCHAR(500) NOT NULL DEFAULT '',
  status VARCHAR(12) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_by UUID REFERENCES public.users(id),
  decided_at TIMESTAMPTZ,
  decision_note VARCHAR(500) NOT NULL DEFAULT '',
  CHECK (
    (status = 'PENDING' AND decided_by IS NULL AND decided_at IS NULL)
    OR (status IN ('CONFIRMED', 'REJECTED') AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS rider_cod_handovers_rider_idx
  ON public.rider_cod_handovers(rider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rider_cod_handovers_pending_idx
  ON public.rider_cod_handovers(created_at) WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS public.rider_cod_handover_items (
  handover_id UUID NOT NULL REFERENCES public.rider_cod_handovers(id),
  collection_id UUID NOT NULL REFERENCES public.rider_cod_collections(id),
  PRIMARY KEY (handover_id, collection_id)
);

-- An order's cash can belong to only one pending or confirmed report.
-- Rejected report items remain in history, but release their claims.
CREATE TABLE IF NOT EXISTS public.rider_cod_handover_claims (
  collection_id UUID PRIMARY KEY REFERENCES public.rider_cod_collections(id),
  handover_id UUID NOT NULL,
  FOREIGN KEY (handover_id, collection_id)
    REFERENCES public.rider_cod_handover_items(handover_id, collection_id)
);

CREATE OR REPLACE FUNCTION public.rider_cod_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'COD audit records cannot be changed or deleted';
END;
$$;
DROP TRIGGER IF EXISTS rider_cod_collections_immutable ON public.rider_cod_collections;
CREATE TRIGGER rider_cod_collections_immutable BEFORE UPDATE OR DELETE
  ON public.rider_cod_collections FOR EACH ROW EXECUTE FUNCTION public.rider_cod_immutable();
DROP TRIGGER IF EXISTS rider_cod_items_immutable ON public.rider_cod_handover_items;
CREATE TRIGGER rider_cod_items_immutable BEFORE UPDATE OR DELETE
  ON public.rider_cod_handover_items FOR EACH ROW EXECUTE FUNCTION public.rider_cod_immutable();
DROP TRIGGER IF EXISTS rider_cod_handovers_no_delete ON public.rider_cod_handovers;
CREATE TRIGGER rider_cod_handovers_no_delete BEFORE DELETE
  ON public.rider_cod_handovers FOR EACH ROW EXECUTE FUNCTION public.rider_cod_immutable();

CREATE OR REPLACE FUNCTION public.rider_cod_capture_delivery()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'DELIVERED' THEN
    INSERT INTO public.rider_cod_collections
      (order_id, rider_id, history_id, amount, currency, collected_at)
    SELECT o.id, NEW.changed_by, NEW.id, o.total, o.currency, NEW.created_at
    FROM public.orders o
    JOIN public.users rider ON rider.id = NEW.changed_by AND rider.role = 'RIDER'
    WHERE o.id = NEW.order_id AND o.payment_method = 'COD'
      AND o.payment_status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS rider_cod_capture_delivery ON public.order_status_history;
CREATE TRIGGER rider_cod_capture_delivery AFTER INSERT ON public.order_status_history
  FOR EACH ROW EXECUTE FUNCTION public.rider_cod_capture_delivery();

-- Import only deliveries with a recorded rider identity. Never infer the
-- collector from the current assignment, which may have changed later.
INSERT INTO public.rider_cod_collections
  (order_id, rider_id, history_id, amount, currency, collected_at)
SELECT DISTINCT ON (o.id)
  o.id, h.changed_by, h.id, o.total, o.currency, h.created_at
FROM public.orders o
JOIN public.order_status_history h ON h.order_id = o.id AND h.status = 'DELIVERED'
JOIN public.users rider ON rider.id = h.changed_by AND rider.role = 'RIDER'
WHERE o.payment_method = 'COD'
  AND o.payment_status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
ORDER BY o.id, h.created_at, h.id
ON CONFLICT (order_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.rider_cod_reserve_collection()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE report public.rider_cod_handovers%ROWTYPE;
cash public.rider_cod_collections%ROWTYPE;
BEGIN
  SELECT * INTO STRICT report FROM public.rider_cod_handovers
    WHERE id = NEW.handover_id FOR UPDATE;
  SELECT * INTO STRICT cash FROM public.rider_cod_collections
    WHERE id = NEW.collection_id FOR UPDATE;
  IF report.status <> 'PENDING' OR report.rider_id <> cash.rider_id
     OR report.currency <> cash.currency THEN
    RAISE EXCEPTION 'Collection does not belong to this pending handover';
  END IF;
  INSERT INTO public.rider_cod_handover_claims(collection_id, handover_id)
    VALUES (NEW.collection_id, NEW.handover_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS rider_cod_reserve_collection ON public.rider_cod_handover_items;
CREATE TRIGGER rider_cod_reserve_collection AFTER INSERT ON public.rider_cod_handover_items
  FOR EACH ROW EXECUTE FUNCTION public.rider_cod_reserve_collection();

CREATE OR REPLACE FUNCTION public.rider_cod_validate_handover()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE report_id UUID;
expected NUMERIC(18,2);
actual NUMERIC(18,2);
BEGIN
  IF TG_TABLE_NAME = 'rider_cod_handovers' THEN report_id := NEW.id;
  ELSE report_id := NEW.handover_id;
  END IF;
  SELECT amount INTO STRICT expected FROM public.rider_cod_handovers WHERE id = report_id;
  SELECT COALESCE(SUM(c.amount), 0) INTO actual
    FROM public.rider_cod_handover_items i
    JOIN public.rider_cod_collections c ON c.id = i.collection_id
    WHERE i.handover_id = report_id;
  IF actual <> expected THEN
    RAISE EXCEPTION 'Handover amount must equal its selected collections';
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS rider_cod_validate_report_total ON public.rider_cod_handovers;
CREATE CONSTRAINT TRIGGER rider_cod_validate_report_total
  AFTER INSERT OR UPDATE ON public.rider_cod_handovers DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.rider_cod_validate_handover();
DROP TRIGGER IF EXISTS rider_cod_validate_item_total ON public.rider_cod_handover_items;
CREATE CONSTRAINT TRIGGER rider_cod_validate_item_total
  AFTER INSERT ON public.rider_cod_handover_items DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.rider_cod_validate_handover();

CREATE OR REPLACE FUNCTION public.rider_cod_check_decision()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'PENDING' THEN RAISE EXCEPTION 'New handovers must be pending'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.rider_id AND role = 'RIDER' AND enabled = TRUE) THEN
      RAISE EXCEPTION 'An enabled rider is required';
    END IF;
  ELSE
    IF OLD.status <> 'PENDING' OR NEW.status NOT IN ('CONFIRMED', 'REJECTED') THEN
      RAISE EXCEPTION 'Only a pending handover can be confirmed or rejected';
    END IF;
    IF ROW(NEW.id, NEW.rider_id, NEW.amount, NEW.currency, NEW.note, NEW.created_at)
      IS DISTINCT FROM ROW(OLD.id, OLD.rider_id, OLD.amount, OLD.currency, OLD.note, OLD.created_at) THEN
      RAISE EXCEPTION 'Handover details cannot be changed';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.decided_by AND role = 'ADMIN' AND enabled = TRUE) THEN
      RAISE EXCEPTION 'An enabled administrator must confirm or reject receipt';
    END IF;
    NEW.decided_at := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS rider_cod_check_decision ON public.rider_cod_handovers;
CREATE TRIGGER rider_cod_check_decision BEFORE INSERT OR UPDATE ON public.rider_cod_handovers
  FOR EACH ROW EXECUTE FUNCTION public.rider_cod_check_decision();

CREATE OR REPLACE FUNCTION public.rider_cod_release_rejected()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'REJECTED' THEN
    DELETE FROM public.rider_cod_handover_claims WHERE handover_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS rider_cod_release_rejected ON public.rider_cod_handovers;
CREATE TRIGGER rider_cod_release_rejected AFTER UPDATE ON public.rider_cod_handovers
  FOR EACH ROW EXECUTE FUNCTION public.rider_cod_release_rejected();

COMMIT;

SELECT COUNT(*) AS recorded_cod_collections,
       COALESCE(SUM(amount), 0) AS recorded_cod_amount
FROM public.rider_cod_collections;

SELECT COUNT(*) AS historical_cod_orders_needing_review
FROM public.orders o
WHERE o.payment_method = 'COD'
  AND o.payment_status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
  AND EXISTS (SELECT 1 FROM public.order_status_history h WHERE h.order_id = o.id AND h.status = 'DELIVERED')
  AND NOT EXISTS (SELECT 1 FROM public.rider_cod_collections c WHERE c.order_id = o.id);
