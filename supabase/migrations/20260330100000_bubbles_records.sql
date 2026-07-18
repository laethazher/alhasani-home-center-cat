-- ============================================================
-- Bubbles Tracking: bubbles_records
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bubbles_records (
  id              BIGSERIAL PRIMARY KEY,
  driver_name     TEXT NOT NULL,
  customer_name   TEXT NOT NULL DEFAULT '',
  product_type    TEXT,
  quantity        NUMERIC NOT NULL DEFAULT 0,
  invoice_number  TEXT,
  location        TEXT,
  cbm             NUMERIC,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'completed', 'delayed', 'issue')),
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  return_time     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bubbles_records_status ON public.bubbles_records(status);
CREATE INDEX IF NOT EXISTS idx_bubbles_records_driver ON public.bubbles_records(driver_name);
CREATE INDEX IF NOT EXISTS idx_bubbles_records_created ON public.bubbles_records(created_at DESC);

ALTER TABLE public.bubbles_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bubbles_records: select scoped"
  ON public.bubbles_records FOR SELECT
  TO authenticated
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') IN (
      'admin', 'manager', 'logistics', 'gate_guard'
    )
  );

CREATE POLICY "bubbles_records: admin insert"
  ON public.bubbles_records FOR INSERT
  TO authenticated
  WITH CHECK (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin'
  );

CREATE POLICY "bubbles_records: admin update"
  ON public.bubbles_records FOR UPDATE
  TO authenticated
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin'
  )
  WITH CHECK (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin'
  );

CREATE POLICY "bubbles_records: admin delete"
  ON public.bubbles_records FOR DELETE
  TO authenticated
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin'
  );

-- Gate: فقط من pending/delayed إلى completed أو issue
CREATE POLICY "bubbles_records: gate_guard update returns"
  ON public.bubbles_records FOR UPDATE
  TO authenticated
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'gate_guard'
    AND status IN ('pending', 'delayed')
  )
  WITH CHECK (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'gate_guard'
    AND status IN ('completed', 'issue')
  );

NOTIFY pgrst, 'reload schema';
