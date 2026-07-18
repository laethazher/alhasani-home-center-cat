-- ============================================================
-- Toolkit availability + deficit compensation tracking
-- ============================================================

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS has_toolkit boolean NOT NULL DEFAULT true;

ALTER TABLE public.installation_vehicles
  ADD COLUMN IF NOT EXISTS has_toolkit boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'operations_vehicles'
  ) THEN
    EXECUTE 'ALTER TABLE public.operations_vehicles ADD COLUMN IF NOT EXISTS has_toolkit boolean NOT NULL DEFAULT true';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.inventory_deficit_compensations (
  id bigserial PRIMARY KEY,
  department_code text NOT NULL CHECK (department_code IN ('tajhiz', 'installation', 'operations')),
  vehicle_id bigint NOT NULL,
  report_id bigint NOT NULL,
  plate_number text,
  responsible_name text,
  deficit_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_deficit integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'compensated', 'not_compensated')),
  compensation_due_date date,
  compensated_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_code, report_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_deficit_compensations_dept_status_due
  ON public.inventory_deficit_compensations (department_code, status, compensation_due_date);

CREATE INDEX IF NOT EXISTS idx_inventory_deficit_compensations_vehicle_created
  ON public.inventory_deficit_compensations (department_code, vehicle_id, created_at DESC);

ALTER TABLE public.inventory_deficit_compensations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_deficit_compensations_select" ON public.inventory_deficit_compensations;
CREATE POLICY "inventory_deficit_compensations_select"
ON public.inventory_deficit_compensations
FOR SELECT TO authenticated
USING (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department')
);

DROP POLICY IF EXISTS "inventory_deficit_compensations_insert" ON public.inventory_deficit_compensations;
CREATE POLICY "inventory_deficit_compensations_insert"
ON public.inventory_deficit_compensations
FOR INSERT TO authenticated
WITH CHECK (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department')
);

DROP POLICY IF EXISTS "inventory_deficit_compensations_update" ON public.inventory_deficit_compensations;
CREATE POLICY "inventory_deficit_compensations_update"
ON public.inventory_deficit_compensations
FOR UPDATE TO authenticated
USING (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department')
)
WITH CHECK (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department')
);
