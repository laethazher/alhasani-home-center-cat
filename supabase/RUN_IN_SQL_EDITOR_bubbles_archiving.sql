-- =============================================================================
-- نفّذ هذا الملف كاملاً في: Supabase Dashboard → SQL Editor → Run
-- Bubbles archiving:
--  - 09:00 Asia/Baghdad: أرشفة كل شيء ما عدا pending
--  - عند حل pending/delayed إلى completed/issue: أرشفة فورية + حذف من bubbles_records
-- =============================================================================

-- نفس محتوى الترحيل: 20260331130000_bubbles_archiving.sql

CREATE TABLE IF NOT EXISTS public.bubbles_records_archive (
  archive_id      BIGSERIAL PRIMARY KEY,
  source_id       BIGINT,
  driver_name     TEXT NOT NULL,
  customer_name   TEXT NOT NULL DEFAULT '',
  product_type    TEXT,
  quantity        NUMERIC NOT NULL DEFAULT 0,
  invoice_number  TEXT,
  location        TEXT,
  cbm             NUMERIC,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'delayed', 'issue')),
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL,
  return_time     TIMESTAMPTZ,
  archived_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_day    DATE NOT NULL,
  archived_reason TEXT NOT NULL DEFAULT 'daily_9am'
);

CREATE INDEX IF NOT EXISTS idx_bubbles_archive_day ON public.bubbles_records_archive(archived_day);
CREATE INDEX IF NOT EXISTS idx_bubbles_archive_status ON public.bubbles_records_archive(status);
CREATE INDEX IF NOT EXISTS idx_bubbles_archive_driver ON public.bubbles_records_archive(driver_name);
CREATE INDEX IF NOT EXISTS idx_bubbles_archive_created ON public.bubbles_records_archive(created_at DESC);

ALTER TABLE public.bubbles_records_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bubbles_archive: select scoped" ON public.bubbles_records_archive;
CREATE POLICY "bubbles_archive: select scoped"
  ON public.bubbles_records_archive FOR SELECT
  TO authenticated
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') IN ('admin', 'manager', 'logistics')
  );

DROP POLICY IF EXISTS "bubbles_archive: admin mutate" ON public.bubbles_records_archive;
CREATE POLICY "bubbles_archive: admin mutate"
  ON public.bubbles_records_archive FOR ALL
  TO authenticated
  USING (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
  WITH CHECK (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');

CREATE TABLE IF NOT EXISTS public.bubbles_daily_snapshots (
  day               DATE PRIMARY KEY,
  drivers_count      INT NOT NULL DEFAULT 0,
  total_records      INT NOT NULL DEFAULT 0,
  pending_count      INT NOT NULL DEFAULT 0,
  completed_count    INT NOT NULL DEFAULT 0,
  delayed_count      INT NOT NULL DEFAULT 0,
  issue_count        INT NOT NULL DEFAULT 0,
  avg_return_hours   NUMERIC,
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bubbles_daily_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bubbles_snapshots: select scoped" ON public.bubbles_daily_snapshots;
CREATE POLICY "bubbles_snapshots: select scoped"
  ON public.bubbles_daily_snapshots FOR SELECT
  TO authenticated
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') IN ('admin', 'manager', 'logistics')
  );

DROP POLICY IF EXISTS "bubbles_snapshots: admin mutate" ON public.bubbles_daily_snapshots;
CREATE POLICY "bubbles_snapshots: admin mutate"
  ON public.bubbles_daily_snapshots FOR ALL
  TO authenticated
  USING (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
  WITH CHECK (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');

CREATE OR REPLACE FUNCTION public.bubbles_baghdad_day(p_ts TIMESTAMPTZ)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_ts AT TIME ZONE 'Asia/Baghdad')::date;
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
    location, cbm, status, reason, created_at, return_time,
    archived_at, archived_day, archived_reason
  )
  SELECT
    id, driver_name, customer_name, product_type, quantity, invoice_number,
    location, cbm, status, reason, created_at, return_time,
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

GRANT EXECUTE ON FUNCTION public.archive_bubbles_daily(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_bubbles_daily(DATE) TO service_role;

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
    location, cbm, status, reason, created_at, return_time,
    archived_at, archived_day, archived_reason
  )
  VALUES (
    NEW.id, NEW.driver_name, NEW.customer_name, NEW.product_type, NEW.quantity, NEW.invoice_number,
    NEW.location, NEW.cbm, NEW.status, NEW.reason, NEW.created_at, NEW.return_time,
    now(), v_day, 'resolved'
  );

  DELETE FROM public.bubbles_records WHERE id = NEW.id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bubbles_archive_on_resolve ON public.bubbles_records;
CREATE TRIGGER trg_bubbles_archive_on_resolve
AFTER UPDATE OF status ON public.bubbles_records
FOR EACH ROW
EXECUTE FUNCTION public.bubbles_archive_on_resolve();

NOTIFY pgrst, 'reload schema';

