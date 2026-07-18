-- تأكيد الحارس لإرجاع الببلز (للفلترة في تبويب «مكتمل») + نسخه للأرشيف عند الحل الفوري والأرشفة اليومية

ALTER TABLE public.bubbles_records
  ADD COLUMN IF NOT EXISTS gate_return_confirmed_at TIMESTAMPTZ;

ALTER TABLE public.bubbles_records_archive
  ADD COLUMN IF NOT EXISTS gate_return_confirmed_at TIMESTAMPTZ;

-- قراءة محدودة للأرشيف: الحارس يرى فقط المكتمل المؤكَّد منه (لعرض تبويب مكتمل)
DROP POLICY IF EXISTS "bubbles_archive: gate_guard select gate-completed" ON public.bubbles_records_archive;
CREATE POLICY "bubbles_archive: gate_guard select gate-completed"
  ON public.bubbles_records_archive FOR SELECT
  TO authenticated
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'gate_guard'
    AND status = 'completed'
    AND gate_return_confirmed_at IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.bubbles_archive_on_resolve()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day DATE;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF (OLD.status NOT IN ('pending', 'delayed')) OR (NEW.status NOT IN ('completed', 'issue')) THEN
    RETURN NEW;
  END IF;

  v_day := public.bubbles_baghdad_day(now());

  INSERT INTO public.bubbles_records_archive (
    source_id, driver_name, customer_name, product_type, quantity, invoice_number,
    location, cbm, status, reason, created_at, return_time, gate_return_confirmed_at,
    archived_at, archived_day, archived_reason
  )
  VALUES (
    NEW.id, NEW.driver_name, NEW.customer_name, NEW.product_type, NEW.quantity, NEW.invoice_number,
    NEW.location, NEW.cbm, NEW.status, NEW.reason, NEW.created_at, NEW.return_time, NEW.gate_return_confirmed_at,
    now(), v_day, 'resolved'
  );

  DELETE FROM public.bubbles_records WHERE id = NEW.id;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_bubbles_daily(p_day DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day DATE;
  v_role TEXT;
  v_archived_count INT := 0;
  v_total INT := 0;
  v_pending INT := 0;
  v_completed INT := 0;
  v_delayed INT := 0;
  v_issue INT := 0;
  v_drivers INT := 0;
  v_avg_return NUMERIC;
BEGIN
  v_role := lower(coalesce(auth.jwt() ->> 'role', ''));
  IF v_role <> 'service_role' THEN
    v_role := lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', ''));
    IF v_role <> 'admin' THEN
      RETURN jsonb_build_object('success', false, 'error', 'admin_only');
    END IF;
  END IF;

  v_day := COALESCE(p_day, public.bubbles_baghdad_day(now()));

  INSERT INTO public.bubbles_records_archive (
    source_id, driver_name, customer_name, product_type, quantity, invoice_number,
    location, cbm, status, reason, created_at, return_time, gate_return_confirmed_at,
    archived_at, archived_day, archived_reason
  )
  SELECT
    id, driver_name, customer_name, product_type, quantity, invoice_number,
    location, cbm, status, reason, created_at, return_time, gate_return_confirmed_at,
    now(), v_day, 'daily_9am'
  FROM public.bubbles_records
  WHERE status <> 'pending';

  GET DIAGNOSTICS v_archived_count = ROW_COUNT;

  DELETE FROM public.bubbles_records
  WHERE status <> 'pending';

  SELECT
    count(*)::int,
    count(*) FILTER (WHERE status = 'completed')::int,
    count(*) FILTER (WHERE status = 'delayed')::int,
    count(*) FILTER (WHERE status = 'issue')::int,
    count(DISTINCT driver_name)::int,
    avg(EXTRACT(EPOCH FROM (return_time - created_at)) / 3600.0)
  INTO v_total, v_completed, v_delayed, v_issue, v_drivers, v_avg_return
  FROM public.bubbles_records_archive
  WHERE archived_day = v_day;

  SELECT count(*)::int INTO v_pending FROM public.bubbles_records WHERE status = 'pending';

  INSERT INTO public.bubbles_daily_snapshots (
    day, drivers_count, total_records, pending_count, completed_count, delayed_count, issue_count, avg_return_hours, generated_at
  )
  VALUES (
    v_day, v_drivers, v_total, v_pending, v_completed, v_delayed, v_issue,
    CASE WHEN v_avg_return IS NULL THEN NULL ELSE round(v_avg_return::numeric, 2) END,
    now()
  )
  ON CONFLICT (day) DO UPDATE SET
    drivers_count = EXCLUDED.drivers_count,
    total_records = EXCLUDED.total_records,
    pending_count = EXCLUDED.pending_count,
    completed_count = EXCLUDED.completed_count,
    delayed_count = EXCLUDED.delayed_count,
    issue_count = EXCLUDED.issue_count,
    avg_return_hours = EXCLUDED.avg_return_hours,
    generated_at = EXCLUDED.generated_at;

  RETURN jsonb_build_object(
    'success', true,
    'day', v_day,
    'archived_count', v_archived_count,
    'pending_left', v_pending
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

NOTIFY pgrst, 'reload schema';
