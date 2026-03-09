-- ============================================================
-- Crew Attendance - Manager DELETE permissions
-- صلاحيات المدير: حذف سجلات الحضور المؤرشفة + حذف الكادر
-- ============================================================

-- attendance_archive: manager can delete
DROP POLICY IF EXISTS "attendance_archive_manager_delete" ON public.attendance_archive;
CREATE POLICY "attendance_archive_manager_delete" ON public.attendance_archive
  FOR DELETE TO authenticated
  USING (get_jwt_role() IN ('admin', 'manager'));

-- staff_members: manager can delete (for crew interface)
DROP POLICY IF EXISTS "staff_members_manager_delete" ON public.staff_members;
CREATE POLICY "staff_members_manager_delete" ON public.staff_members
  FOR DELETE TO authenticated
  USING (get_jwt_role() IN ('admin', 'manager'));
