-- =============================================================================
-- نفّذ هذا الملف كاملاً في: Supabase Dashboard → SQL Editor → Run
-- يصلح خطأ: Could not find the 'loading_issue_reason' column ... schema cache
-- (نسخة مطابقة للترحيل + إعادة تحميل كاش الـ API)
-- =============================================================================

ALTER TABLE public.exit_requests
  ADD COLUMN IF NOT EXISTS vehicle_cbm NUMERIC,
  ADD COLUMN IF NOT EXISTS loading_verified BOOLEAN,
  ADD COLUMN IF NOT EXISTS loading_issue_reason TEXT;

COMMENT ON COLUMN public.exit_requests.vehicle_cbm IS 'Vehicle volume in CBM (cubic meters)';
COMMENT ON COLUMN public.exit_requests.loading_verified IS 'True if gate confirmed load used clamps; false if issue reported';
COMMENT ON COLUMN public.exit_requests.loading_issue_reason IS 'Reason when loading without clamps (pending_issue flow)';

ALTER TABLE public.exit_requests DROP CONSTRAINT IF EXISTS exit_requests_status_check;

ALTER TABLE public.exit_requests
  ADD CONSTRAINT exit_requests_status_check
  CHECK (status IN (
    'pending',
    'approved',
    'rejected',
    'exited',
    'pending_issue',
    'approved_override'
  ));

DROP POLICY IF EXISTS "exit_requests: gate_guard update" ON public.exit_requests;
DROP POLICY IF EXISTS "exit_requests: gate_guard approve_to_exit_or_issue" ON public.exit_requests;
DROP POLICY IF EXISTS "exit_requests: gate_guard exited_updates" ON public.exit_requests;

CREATE POLICY "exit_requests: gate_guard approve_to_exit_or_issue"
  ON public.exit_requests FOR UPDATE
  TO authenticated
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'gate_guard'
    AND status IN ('approved', 'approved_override')
  )
  WITH CHECK (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'gate_guard'
    AND status IN ('exited', 'pending_issue')
  );

CREATE POLICY "exit_requests: gate_guard exited_updates"
  ON public.exit_requests FOR UPDATE
  TO authenticated
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'gate_guard'
    AND status = 'exited'
  )
  WITH CHECK (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'gate_guard'
    AND status = 'exited'
  );

NOTIFY pgrst, 'reload schema';
