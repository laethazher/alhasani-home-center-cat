-- ============================================================
-- Crew Attendance - RLS Policies
-- Uses get_jwt_role() for consistency with existing migrations
-- ============================================================

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_activity_log ENABLE ROW LEVEL SECURITY;

-- attendance: admin full access; manager can read
DROP POLICY IF EXISTS "attendance_admin_all" ON public.attendance;
CREATE POLICY "attendance_admin_all" ON public.attendance
  FOR ALL TO authenticated
  USING (get_jwt_role() = 'admin')
  WITH CHECK (get_jwt_role() = 'admin');

DROP POLICY IF EXISTS "attendance_manager_select" ON public.attendance;
CREATE POLICY "attendance_manager_select" ON public.attendance
  FOR SELECT TO authenticated
  USING (get_jwt_role() IN ('admin', 'manager'));

-- attendance_archive: admin full; manager read
DROP POLICY IF EXISTS "attendance_archive_admin_all" ON public.attendance_archive;
CREATE POLICY "attendance_archive_admin_all" ON public.attendance_archive
  FOR ALL TO authenticated
  USING (get_jwt_role() = 'admin')
  WITH CHECK (get_jwt_role() = 'admin');

DROP POLICY IF EXISTS "attendance_archive_manager_select" ON public.attendance_archive;
CREATE POLICY "attendance_archive_manager_select" ON public.attendance_archive
  FOR SELECT TO authenticated
  USING (get_jwt_role() IN ('admin', 'manager'));

-- Manager can update archived records (post-archive edits per plan)
DROP POLICY IF EXISTS "attendance_archive_manager_update" ON public.attendance_archive;
CREATE POLICY "attendance_archive_manager_update" ON public.attendance_archive
  FOR UPDATE TO authenticated
  USING (get_jwt_role() IN ('admin', 'manager'))
  WITH CHECK (get_jwt_role() IN ('admin', 'manager'));

-- activity_log: admin + manager read; admin + manager insert
DROP POLICY IF EXISTS "attendance_activity_log_select" ON public.attendance_activity_log;
CREATE POLICY "attendance_activity_log_select" ON public.attendance_activity_log
  FOR SELECT TO authenticated
  USING (get_jwt_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS "attendance_activity_log_insert" ON public.attendance_activity_log;
CREATE POLICY "attendance_activity_log_insert" ON public.attendance_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() IN ('admin', 'manager'));
