-- ============================================================
-- Reports performance indexes (history + latest report queries)
-- ============================================================

-- Core reports table (tajhiz)
CREATE INDEX IF NOT EXISTS idx_reports_created_at_desc
  ON public.reports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_vehicle_created_at_desc
  ON public.reports (vehicle_id, created_at DESC);

-- Installation isolated reports table
CREATE INDEX IF NOT EXISTS idx_installation_reports_created_at_desc
  ON public.installation_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_installation_reports_vehicle_created_at_desc
  ON public.installation_reports (vehicle_id, created_at DESC);

-- Operations isolated reports table
CREATE INDEX IF NOT EXISTS idx_operations_reports_created_at_desc
  ON public.operations_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operations_reports_vehicle_created_at_desc
  ON public.operations_reports (vehicle_id, created_at DESC);
