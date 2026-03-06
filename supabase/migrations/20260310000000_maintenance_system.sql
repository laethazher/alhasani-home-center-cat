-- ============================================================
-- Vehicle Maintenance Management System
-- ============================================================

-- 1. Expand user_profiles role CHECK to include maintenance_manager
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin','driver','manager','warehouse','logistics','gate_guard','maintenance_manager'));

-- 2. maintenance_requests
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id  BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id   BIGINT REFERENCES staff_members(id) ON DELETE SET NULL,
  maintenance_type TEXT NOT NULL DEFAULT 'صيانة عامة',
  description TEXT,
  priority    TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','urgent')),
  admin_notes TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','in_progress','completed')),
  images      TEXT[] DEFAULT '{}',
  requested_by UUID REFERENCES auth.users(id),
  approved_by  UUID REFERENCES auth.users(id),
  approved_at  TIMESTAMPTZ,
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. maintenance_records
CREATE TABLE IF NOT EXISTS maintenance_records (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id       BIGINT REFERENCES maintenance_requests(id) ON DELETE SET NULL,
  vehicle_id       BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  maintenance_type TEXT,
  fault_description TEXT,
  work_done        TEXT,
  inspection_only  BOOLEAN DEFAULT false,
  parts_replaced   TEXT,
  technician_name  TEXT,
  cost             NUMERIC(12,2) DEFAULT 0,
  duration_minutes INT,
  odometer_at      INT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. maintenance_images
CREATE TABLE IF NOT EXISTS maintenance_images (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id  BIGINT REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  record_id   BIGINT REFERENCES maintenance_records(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  image_type  TEXT NOT NULL DEFAULT 'issue'
    CHECK (image_type IN ('before','during','after','invoice','issue')),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. spare_parts
CREATE TABLE IF NOT EXISTS spare_parts (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL,
  part_number TEXT,
  supplier    TEXT,
  price       NUMERIC(10,2) DEFAULT 0,
  quantity    INT DEFAULT 0,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. spare_part_usage
CREATE TABLE IF NOT EXISTS spare_part_usage (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id     BIGINT NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  part_id       BIGINT NOT NULL REFERENCES spare_parts(id) ON DELETE CASCADE,
  quantity_used INT DEFAULT 1,
  unit_cost     NUMERIC(10,2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. driver_issue_reports
CREATE TABLE IF NOT EXISTS driver_issue_reports (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id  BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id   BIGINT REFERENCES staff_members(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  images      TEXT[] DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','reviewed','converted')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. periodic_maintenance
CREATE TABLE IF NOT EXISTS periodic_maintenance (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id        BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  maintenance_type  TEXT NOT NULL,
  last_performed_at DATE,
  next_due_date     DATE,
  next_due_km       INT,
  interval_days     INT,
  interval_km       INT,
  status            TEXT NOT NULL DEFAULT 'good'
    CHECK (status IN ('good','approaching','overdue')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. maintenance_notifications
CREATE TABLE IF NOT EXISTS maintenance_notifications (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id        BIGINT REFERENCES vehicles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title             TEXT NOT NULL,
  message           TEXT,
  is_read           BOOLEAN DEFAULT false,
  due_date          DATE,
  target_role       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_maint_req_vehicle   ON maintenance_requests(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maint_req_status    ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maint_req_created   ON maintenance_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_maint_rec_vehicle   ON maintenance_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maint_rec_request   ON maintenance_records(request_id);
CREATE INDEX IF NOT EXISTS idx_maint_img_request   ON maintenance_images(request_id);
CREATE INDEX IF NOT EXISTS idx_maint_img_record    ON maintenance_images(record_id);
CREATE INDEX IF NOT EXISTS idx_driver_issues_vehicle ON driver_issue_reports(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_periodic_maint_vehicle ON periodic_maintenance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maint_notif_read    ON maintenance_notifications(is_read);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE maintenance_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_images        ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_part_usage          ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_issue_reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE periodic_maintenance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_notifications ENABLE ROW LEVEL SECURITY;

-- Helper: get role from JWT
CREATE OR REPLACE FUNCTION get_jwt_role() RETURNS TEXT AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'user_role',
    ''
  );
$$ LANGUAGE sql STABLE;

-- maintenance_requests policies
CREATE POLICY "maint_req_select" ON maintenance_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "maint_req_insert" ON maintenance_requests FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() IN ('admin','maintenance_manager'));
CREATE POLICY "maint_req_update" ON maintenance_requests FOR UPDATE TO authenticated
  USING (get_jwt_role() IN ('admin','maintenance_manager'));
CREATE POLICY "maint_req_delete" ON maintenance_requests FOR DELETE TO authenticated
  USING (get_jwt_role() IN ('admin','maintenance_manager'));

-- maintenance_records policies
CREATE POLICY "maint_rec_select" ON maintenance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "maint_rec_insert" ON maintenance_records FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() IN ('admin','maintenance_manager'));
CREATE POLICY "maint_rec_update" ON maintenance_records FOR UPDATE TO authenticated
  USING (get_jwt_role() IN ('admin','maintenance_manager'));

-- maintenance_images policies
CREATE POLICY "maint_img_select" ON maintenance_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "maint_img_insert" ON maintenance_images FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() IN ('admin','maintenance_manager'));

-- spare_parts policies
CREATE POLICY "spare_parts_select" ON spare_parts FOR SELECT TO authenticated USING (true);
CREATE POLICY "spare_parts_insert" ON spare_parts FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() IN ('admin','maintenance_manager'));
CREATE POLICY "spare_parts_update" ON spare_parts FOR UPDATE TO authenticated
  USING (get_jwt_role() IN ('admin','maintenance_manager'));
CREATE POLICY "spare_parts_delete" ON spare_parts FOR DELETE TO authenticated
  USING (get_jwt_role() IN ('admin','maintenance_manager'));

-- spare_part_usage policies
CREATE POLICY "spare_usage_select" ON spare_part_usage FOR SELECT TO authenticated USING (true);
CREATE POLICY "spare_usage_insert" ON spare_part_usage FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() IN ('admin','maintenance_manager'));

-- driver_issue_reports policies
CREATE POLICY "driver_issues_select" ON driver_issue_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "driver_issues_insert" ON driver_issue_reports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "driver_issues_update" ON driver_issue_reports FOR UPDATE TO authenticated
  USING (get_jwt_role() IN ('admin','maintenance_manager'));

-- periodic_maintenance policies
CREATE POLICY "periodic_maint_select" ON periodic_maintenance FOR SELECT TO authenticated USING (true);
CREATE POLICY "periodic_maint_insert" ON periodic_maintenance FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() IN ('admin','maintenance_manager'));
CREATE POLICY "periodic_maint_update" ON periodic_maintenance FOR UPDATE TO authenticated
  USING (get_jwt_role() IN ('admin','maintenance_manager'));
CREATE POLICY "periodic_maint_delete" ON periodic_maintenance FOR DELETE TO authenticated
  USING (get_jwt_role() IN ('admin','maintenance_manager'));

-- maintenance_notifications policies
CREATE POLICY "maint_notif_select" ON maintenance_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "maint_notif_insert" ON maintenance_notifications FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() IN ('admin','maintenance_manager'));
CREATE POLICY "maint_notif_update" ON maintenance_notifications FOR UPDATE TO authenticated
  USING (get_jwt_role() IN ('admin','maintenance_manager'));

-- ============================================================
-- Supabase Storage bucket for maintenance images
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-images', 'maintenance-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "maint_images_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'maintenance-images');
CREATE POLICY "maint_images_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'maintenance-images');
CREATE POLICY "maint_images_public_read" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'maintenance-images');
