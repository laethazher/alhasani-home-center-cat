-- ============================================================
--  Alhasani Home Center – Core Tables (no RLS, no policies)
-- ============================================================

-- 1) user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          UUID           PRIMARY KEY
                             REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name   TEXT           NOT NULL,
  role        TEXT           NOT NULL
                             CHECK (role IN ('admin','driver','manager','warehouse','logistics')),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- 2) vehicles
CREATE TABLE IF NOT EXISTS public.vehicles (
  id            BIGINT         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plate_number  TEXT           UNIQUE NOT NULL,
  model         TEXT,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- 3) reports
CREATE TABLE IF NOT EXISTS public.reports (
  id                    BIGINT         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id               UUID           NOT NULL
                                       REFERENCES auth.users (id) ON DELETE CASCADE,
  vehicle_id            BIGINT         REFERENCES public.vehicles (id),
  driver_name           TEXT,
  truck_number          TEXT,
  date                  DATE,
  damage_points         JSONB,
  inspection_values     JSONB,
  tool_values           JSONB,
  tool_images           JSONB,
  driver_signature      TEXT,
  equipment_manager     TEXT,
  logistics_manager     TEXT,
  warehouse_manager     TEXT,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reports_user_id    ON public.reports (user_id);
CREATE INDEX IF NOT EXISTS idx_reports_vehicle_id ON public.reports (vehicle_id);
