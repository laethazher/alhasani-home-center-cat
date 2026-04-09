-- ============================================================
-- Post-Inspection Recovery (Additive)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inspection_recovery (
  id bigserial PRIMARY KEY,
  inspection_id bigint NOT NULL,
  vehicle_id bigint NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  department text NOT NULL CHECK (department IN ('tajhiz', 'installation')),
  item_name text NOT NULL,
  required_qty integer NOT NULL CHECK (required_qty >= 0),
  actual_qty integer NOT NULL CHECK (actual_qty >= 0),
  missing_qty integer NOT NULL CHECK (missing_qty >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'resolved')),
  action_type text NOT NULL DEFAULT 'auto' CHECK (action_type IN ('manual', 'auto')),
  scheduled_date date,
  resolved_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspection_recovery_dept_status_sched
  ON public.inspection_recovery (department, status, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_inspection_recovery_inspection_id
  ON public.inspection_recovery (inspection_id);

CREATE INDEX IF NOT EXISTS idx_inspection_recovery_vehicle_user_created
  ON public.inspection_recovery (vehicle_id, user_id, created_at DESC);

ALTER TABLE public.inspection_recovery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_recovery_select" ON public.inspection_recovery;
CREATE POLICY "inspection_recovery_select"
ON public.inspection_recovery
FOR SELECT TO authenticated
USING (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department')
);

DROP POLICY IF EXISTS "inspection_recovery_insert" ON public.inspection_recovery;
CREATE POLICY "inspection_recovery_insert"
ON public.inspection_recovery
FOR INSERT TO authenticated
WITH CHECK (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department')
);

DROP POLICY IF EXISTS "inspection_recovery_update" ON public.inspection_recovery;
CREATE POLICY "inspection_recovery_update"
ON public.inspection_recovery
FOR UPDATE TO authenticated
USING (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department')
)
WITH CHECK (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department')
);
