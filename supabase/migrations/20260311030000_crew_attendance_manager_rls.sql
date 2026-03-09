-- ============================================================
-- Crew Attendance - Allow manager to INSERT/UPDATE attendance
-- Plan: admin + manager can access pages; manager should save records
-- ============================================================

DROP POLICY IF EXISTS "attendance_manager_insert" ON public.attendance;
CREATE POLICY "attendance_manager_insert" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS "attendance_manager_update" ON public.attendance;
CREATE POLICY "attendance_manager_update" ON public.attendance
  FOR UPDATE TO authenticated
  USING (get_jwt_role() IN ('admin', 'manager'))
  WITH CHECK (get_jwt_role() IN ('admin', 'manager'));
