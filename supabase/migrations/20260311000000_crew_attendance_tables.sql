-- ============================================================
-- Crew Attendance Management Module - Tables
-- attendance, attendance_archive, attendance_activity_log
-- ============================================================

-- 1. attendance (الحضور اليومي النشط)
CREATE TABLE IF NOT EXISTS public.attendance (
  id               BIGSERIAL PRIMARY KEY,
  staff_id         BIGINT NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  attendance_date  DATE NOT NULL,
  attendance_type TEXT NOT NULL CHECK (attendance_type IN ('present', 'late', 'absent', 'full_leave', 'time_leave')),
  check_in_time   TIME,
  check_out_time  TIME,
  notes           TEXT,
  vehicle_id      BIGINT REFERENCES public.vehicles(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_time_leave_times CHECK (
    attendance_type <> 'time_leave' OR (check_in_time IS NOT NULL AND check_out_time IS NOT NULL AND check_out_time > check_in_time)
  ),
  UNIQUE (staff_id, attendance_date)
);

-- 2. attendance_archive (أرشيف الحضور)
CREATE TABLE IF NOT EXISTS public.attendance_archive (
  id               BIGSERIAL PRIMARY KEY,
  staff_id         BIGINT NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  attendance_date  DATE NOT NULL,
  attendance_type  TEXT NOT NULL CHECK (attendance_type IN ('present', 'late', 'absent', 'full_leave', 'time_leave')),
  check_in_time   TIME,
  check_out_time  TIME,
  notes           TEXT,
  vehicle_id      BIGINT REFERENCES public.vehicles(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES auth.users(id),
  archived_by     UUID REFERENCES auth.users(id),
  archived_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_archive_time_leave CHECK (
    attendance_type <> 'time_leave' OR (check_in_time IS NOT NULL AND check_out_time IS NOT NULL AND check_out_time > check_in_time)
  )
);

-- 3. attendance_activity_log (سجل النشاط)
CREATE TABLE IF NOT EXISTS public.attendance_activity_log (
  id          BIGSERIAL PRIMARY KEY,
  action_type TEXT NOT NULL CHECK (action_type IN ('add', 'edit', 'archive', 'export')),
  entity_type TEXT NOT NULL DEFAULT 'attendance',
  metadata    JSONB DEFAULT '{}',
  user_id     UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date ON public.attendance(staff_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_type ON public.attendance(attendance_type);

CREATE INDEX IF NOT EXISTS idx_attendance_archive_staff_date ON public.attendance_archive(staff_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_archive_date ON public.attendance_archive(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_archive_type ON public.attendance_archive(attendance_type);

CREATE INDEX IF NOT EXISTS idx_attendance_activity_log_created ON public.attendance_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_activity_log_user ON public.attendance_activity_log(user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attendance_updated ON public.attendance;
CREATE TRIGGER trg_attendance_updated
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_attendance_updated_at();
