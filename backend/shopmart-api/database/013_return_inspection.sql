BEGIN;
LOCK TABLE public.return_requests IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS instructions_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS instructions_sent_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS workflow_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS legacy_status VARCHAR(20);
-- Replace only checks involving return status, leaving amount/reason/refund enum checks intact.
DO $$ DECLARE c RECORD; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.return_requests'::regclass
   AND contype='c' AND pg_get_constraintdef(oid) ~ '\mstatus\M'
 LOOP EXECUTE format('ALTER TABLE public.return_requests DROP CONSTRAINT %I', c.conname); END LOOP;
END $$;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.return_requests'::regclass AND tgname='return_activity_notification') THEN
  ALTER TABLE public.return_requests DISABLE TRIGGER return_activity_notification;
 END IF;
END $$;
-- Preserve old decisions in legacy_status. Old approvals without a parcel return to Pending;
-- customers must be contacted under the new process. Old received/refunded goods retain acceptance.
UPDATE public.return_requests SET legacy_status=status WHERE legacy_status IS NULL AND workflow_version=1;
UPDATE public.return_requests SET status='PENDING', reviewed_by=NULL, reviewed_at=NULL,
  workflow_version=2 WHERE workflow_version=1 AND legacy_status='APPROVED' AND received_at IS NULL;
UPDATE public.return_requests SET status='APPROVED' WHERE workflow_version=1 AND status='RECEIVED';
UPDATE public.return_requests SET workflow_version=2 WHERE workflow_version=1 AND status='PENDING';
ALTER TABLE public.return_requests ALTER COLUMN workflow_version SET DEFAULT 2;
ALTER TABLE public.return_requests ADD CONSTRAINT return_inspection_status_check CHECK(status IN ('PENDING','RECEIVED','APPROVED','REJECTED'));
ALTER TABLE public.return_requests ADD CONSTRAINT return_inspection_review_check CHECK(
 (status IN ('APPROVED','REJECTED') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
 OR (status IN ('PENDING','RECEIVED') AND reviewed_by IS NULL AND reviewed_at IS NULL));
ALTER TABLE public.return_requests ADD CONSTRAINT return_inspection_receipt_check CHECK(
 (status='PENDING' AND received_by IS NULL AND received_at IS NULL)
 OR (status IN ('RECEIVED','APPROVED') AND received_by IS NOT NULL AND received_at IS NOT NULL)
 OR (status='REJECTED' AND (workflow_version=1 OR (received_by IS NOT NULL AND received_at IS NOT NULL))));
ALTER TABLE public.return_requests DROP CONSTRAINT IF EXISTS return_inspection_contact_check;
ALTER TABLE public.return_requests ADD CONSTRAINT return_inspection_contact_check CHECK(
 (instructions_sent_at IS NULL)=(instructions_sent_by IS NULL));
ALTER TABLE public.return_requests ADD CONSTRAINT return_inspection_before_decision_check CHECK(
 workflow_version=1 OR status='PENDING' OR (instructions_sent_at IS NOT NULL AND instructions_sent_by IS NOT NULL));
ALTER TABLE public.return_requests ADD CONSTRAINT return_inspection_rejection_check CHECK(
 status<>'REJECTED' OR workflow_version=1 OR (rejection_reason IS NOT NULL AND length(trim(rejection_reason))>0));
ALTER TABLE public.return_requests ADD CONSTRAINT return_inspection_refund_check CHECK(
 (refund_status='NOT_INITIATED' AND refunded_by IS NULL AND refunded_at IS NULL AND refund_reference IS NULL)
 OR (refund_status='REFUNDED' AND status='APPROVED' AND refunded_by IS NOT NULL AND refunded_at IS NOT NULL AND refund_reference IS NOT NULL AND length(trim(refund_reference))>0));
-- The existing notification -> email outbox trigger sends these messages through the configured mail provider.
CREATE OR REPLACE FUNCTION public.notify_return_activity()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE target_order UUID; target_customer UUID; number TEXT; event TEXT; heading TEXT; detail TEXT;
BEGIN
 SELECT o.id,o.user_id,o.order_number INTO target_order,target_customer,number
 FROM public.order_items i JOIN public.orders o ON o.id=i.order_id WHERE i.id=NEW.order_item_id;
 IF TG_OP='INSERT' THEN
   event:='RETURN_REQUESTED:'||NEW.id; heading:='Return request submitted';
   detail:='A return request for order '||number||' has been submitted. ShopMart will contact you with warehouse return instructions.';
 ELSIF NEW.refund_status IS DISTINCT FROM OLD.refund_status AND NEW.refund_status='REFUNDED' THEN
   event:='RETURN_REFUNDED:'||NEW.id; heading:='Refund recorded';
   detail:='A refund of PKR '||NEW.refund_amount::TEXT||' has been recorded for order '||number||'.';
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
   event:='RETURN_STATUS:'||NEW.id||':'||NEW.status; heading:='Return update';
   detail:=CASE NEW.status
     WHEN 'RECEIVED' THEN 'Your returned product for order '||number||' has arrived at the warehouse and is awaiting inspection.'
     WHEN 'APPROVED' THEN 'Your returned product for order '||number||' has been inspected and accepted. We will update you about the refund.'
     WHEN 'REJECTED' THEN 'Your return for order '||number||' was rejected after inspection. Reason: '||COALESCE(NEW.rejection_reason,'Please contact ShopMart for details.')||'. Your product will be shipped back to your delivery address soon. We will share dispatch details when available.'
     ELSE 'The return request for order '||number||' is now '||lower(NEW.status)||'.' END;
 ELSE RETURN NEW;
 END IF;
 INSERT INTO public.notifications(user_id,event_key,type,title,message,order_id)
 SELECT u.id,event,'RETURN_UPDATE',heading,detail,target_order FROM public.users u
 WHERE u.enabled=TRUE AND (u.id=target_customer OR u.role='ADMIN')
 ON CONFLICT(user_id,event_key) DO NOTHING;
 RETURN NEW;
END $$;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.return_requests'::regclass AND tgname='return_activity_notification') THEN
  ALTER TABLE public.return_requests ENABLE TRIGGER return_activity_notification;
 END IF;
END $$;
COMMIT;
