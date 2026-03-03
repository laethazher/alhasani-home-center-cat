-- ============================================================
-- Enhanced Vehicles System: more fields + maintenance log
-- ============================================================

-- 1) Add new columns to vehicles table
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS vehicle_type     TEXT DEFAULT 'شاحنة',
  ADD COLUMN IF NOT EXISTS color            TEXT,
  ADD COLUMN IF NOT EXISTS year             INT,
  ADD COLUMN IF NOT EXISTS chassis_number   TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS fuel_type        TEXT DEFAULT 'ديزل',
  ADD COLUMN IF NOT EXISTS odometer_km      INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'available' CHECK (status IN ('available','maintenance','broken','reserved')),
  ADD COLUMN IF NOT EXISTS license_expiry   DATE,
  ADD COLUMN IF NOT EXISTS insurance_expiry DATE,
  ADD COLUMN IF NOT EXISTS image_url        TEXT,
  ADD COLUMN IF NOT EXISTS notes            TEXT,
  ADD COLUMN IF NOT EXISTS assigned_driver_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2) Create maintenance log table
CREATE TABLE IF NOT EXISTS public.vehicle_maintenance (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id      BIGINT NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL DEFAULT 'صيانة دورية',
  description     TEXT,
  cost            NUMERIC(10,2) DEFAULT 0,
  odometer_at     INT,
  performed_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  next_maintenance_date DATE,
  next_maintenance_km   INT,
  performed_by    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) RLS for vehicle_maintenance
ALTER TABLE public.vehicle_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_maintenance_select_all" ON public.vehicle_maintenance
  FOR SELECT USING (true);

CREATE POLICY "vehicle_maintenance_admin_insert" ON public.vehicle_maintenance
  FOR INSERT WITH CHECK (
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'user_role') = 'admin'
  );

CREATE POLICY "vehicle_maintenance_admin_update" ON public.vehicle_maintenance
  FOR UPDATE USING (
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'user_role') = 'admin'
  );

CREATE POLICY "vehicle_maintenance_admin_delete" ON public.vehicle_maintenance
  FOR DELETE USING (
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'user_role') = 'admin'
  );

-- 4) Update trigger for vehicles.updated_at
CREATE OR REPLACE FUNCTION public.update_vehicles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_vehicles_updated_at();
