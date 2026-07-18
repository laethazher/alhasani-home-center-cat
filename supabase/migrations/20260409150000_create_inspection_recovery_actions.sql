-- ============================================================
-- Inspection recovery action history (Additive)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inspection_recovery_actions (
  id bigserial PRIMARY KEY,
  recovery_id bigint REFERENCES public.inspection_recovery(id) ON DELETE SET NULL,
  inspection_id bigint NOT NULL,
  vehicle_id bigint NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  department text NOT NULL CHECK (department IN ('tajhiz', 'installation')),
  item_name text NOT NULL,
  previous_status text CHECK (previous_status IN ('pending', 'scheduled', 'resolved')),
  next_status text NOT NULL CHECK (next_status IN ('pending', 'scheduled', 'resolved')),
  action_type text NOT NULL CHECK (action_type IN ('manual', 'auto')),
  reason text,
  scheduled_date date,
  acted_at timestamptz NOT NULL DEFAULT now(),
  acted_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_inspection_recovery_actions_dept_vehicle_acted
  ON public.inspection_recovery_actions (department, vehicle_id, acted_at DESC);

CREATE INDEX IF NOT EXISTS idx_inspection_recovery_actions_recovery_id
  ON public.inspection_recovery_actions (recovery_id, acted_at DESC);

CREATE INDEX IF NOT EXISTS idx_inspection_recovery_actions_inspection_id
  ON public.inspection_recovery_actions (inspection_id, acted_at DESC);

ALTER TABLE public.inspection_recovery_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_recovery_actions_select" ON public.inspection_recovery_actions;
CREATE POLICY "inspection_recovery_actions_select"
ON public.inspection_recovery_actions
FOR SELECT TO authenticated
USING (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department', 'logistics')
);

DROP POLICY IF EXISTS "inspection_recovery_actions_insert" ON public.inspection_recovery_actions;
CREATE POLICY "inspection_recovery_actions_insert"
ON public.inspection_recovery_actions
FOR INSERT TO authenticated
WITH CHECK (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department', 'logistics')
);
