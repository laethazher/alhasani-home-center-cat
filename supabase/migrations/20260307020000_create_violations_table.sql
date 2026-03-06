-- ============================================================
-- Migration: Create Violations Table
-- جدول للمخالفات اليدوية (غير المستخرجة من exit_requests)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.violations (
  id              BIGSERIAL PRIMARY KEY,
  staff_id        BIGINT NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  violation_type  TEXT NOT NULL,
  violation_reason TEXT NOT NULL,
  violation_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_violations_staff_id ON public.violations(staff_id);
CREATE INDEX IF NOT EXISTS idx_violations_date ON public.violations(violation_date DESC);

-- RLS
ALTER TABLE public.violations ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "violations: select for authenticated"
  ON public.violations FOR SELECT
  TO authenticated
  USING (true);

-- Only admin can insert/update/delete
CREATE POLICY "violations: admin manage"
  ON public.violations FOR ALL
  TO authenticated
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin'
  )
  WITH CHECK (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin'
  );
