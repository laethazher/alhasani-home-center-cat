-- ============================================================
-- Fix: Add RLS policies for vehicles table
-- Also fix FK on exit_requests to SET NULL on vehicle delete
-- ============================================================

-- 1) Vehicles RLS policies
CREATE POLICY "vehicles_select_all" ON public.vehicles
  FOR SELECT USING (true);

CREATE POLICY "vehicles_admin_insert" ON public.vehicles
  FOR INSERT WITH CHECK (
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'user_role') = 'admin'
  );

CREATE POLICY "vehicles_admin_update" ON public.vehicles
  FOR UPDATE USING (
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'user_role') = 'admin'
  );

CREATE POLICY "vehicles_admin_delete" ON public.vehicles
  FOR DELETE USING (
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'user_role') = 'admin'
  );

-- 2) Fix FK on exit_requests.vehicle_id to SET NULL on delete
ALTER TABLE public.exit_requests
  DROP CONSTRAINT IF EXISTS exit_requests_vehicle_id_fkey;

ALTER TABLE public.exit_requests
  ADD CONSTRAINT exit_requests_vehicle_id_fkey
  FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;
