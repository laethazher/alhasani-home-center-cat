-- ============================================================
-- Recovery compensation reasons + comparison metadata (Additive)
-- ============================================================

ALTER TABLE public.inspection_recovery
  ADD COLUMN IF NOT EXISTS baseline_actual_qty integer CHECK (baseline_actual_qty >= 0);

ALTER TABLE public.inspection_recovery
  ADD COLUMN IF NOT EXISTS is_repeat_shortage boolean NOT NULL DEFAULT false;

ALTER TABLE public.inspection_recovery
  ADD COLUMN IF NOT EXISTS delta_since_last_compensation integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.inspection_recovery_compensation_reasons (
  id bigserial PRIMARY KEY,
  recovery_id bigint REFERENCES public.inspection_recovery(id) ON DELETE SET NULL,
  recovery_action_id bigint REFERENCES public.inspection_recovery_actions(id) ON DELETE SET NULL,
  inspection_id bigint NOT NULL,
  vehicle_id bigint NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  department text NOT NULL CHECK (department IN ('tajhiz', 'installation', 'operations')),
  driver_name text,
  item_name text NOT NULL,
  item_barcode text,
  compensated_qty integer NOT NULL CHECK (compensated_qty >= 0),
  remaining_qty_after_action integer NOT NULL DEFAULT 0 CHECK (remaining_qty_after_action >= 0),
  reason_category text NOT NULL CHECK (reason_category IN ('customer_compensation', 'sale', 'damage', 'loss', 'other')),
  reason_details text,
  customer_name text,
  invoice_number text,
  compensated_item_name text,
  compensated_item_barcode text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_recovery_reasons_dept_occurred
  ON public.inspection_recovery_compensation_reasons (department, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_recovery_reasons_recovery_id
  ON public.inspection_recovery_compensation_reasons (recovery_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recovery_reasons_vehicle_item
  ON public.inspection_recovery_compensation_reasons (department, vehicle_id, item_name, created_at DESC);

ALTER TABLE public.inspection_recovery_compensation_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_recovery_compensation_reasons_select" ON public.inspection_recovery_compensation_reasons;
CREATE POLICY "inspection_recovery_compensation_reasons_select"
ON public.inspection_recovery_compensation_reasons
FOR SELECT TO authenticated
USING (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department', 'logistics')
);

DROP POLICY IF EXISTS "inspection_recovery_compensation_reasons_insert" ON public.inspection_recovery_compensation_reasons;
CREATE POLICY "inspection_recovery_compensation_reasons_insert"
ON public.inspection_recovery_compensation_reasons
FOR INSERT TO authenticated
WITH CHECK (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department', 'logistics')
);

DROP POLICY IF EXISTS "inspection_recovery_compensation_reasons_update" ON public.inspection_recovery_compensation_reasons;
CREATE POLICY "inspection_recovery_compensation_reasons_update"
ON public.inspection_recovery_compensation_reasons
FOR UPDATE TO authenticated
USING (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department', 'logistics')
)
WITH CHECK (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department', 'logistics')
);
