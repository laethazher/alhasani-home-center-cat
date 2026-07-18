-- ============================================================
-- Migration: Enhance Exit Requests
-- Adds: exit_reason, vehicle tracking, assistant return confirmation
-- ============================================================

-- 1) Add new columns to exit_requests
ALTER TABLE public.exit_requests
  ADD COLUMN IF NOT EXISTS exit_reason TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_id BIGINT REFERENCES public.vehicles(id),
  ADD COLUMN IF NOT EXISTS vehicle_plate TEXT,
  ADD COLUMN IF NOT EXISTS assistant_returns JSONB DEFAULT '{}';

-- 2) Update gate_guard RLS to also allow updating 'exited' records (for return confirmations)
DROP POLICY IF EXISTS "exit_requests: gate_guard confirm exit" ON public.exit_requests;

CREATE POLICY "exit_requests: gate_guard update"
  ON public.exit_requests FOR UPDATE
  TO authenticated
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'gate_guard'
    AND status IN ('approved', 'exited')
  )
  WITH CHECK (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'gate_guard'
    AND status = 'exited'
  );

-- 3) Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_exit_requests_vehicle ON public.exit_requests(vehicle_id);
