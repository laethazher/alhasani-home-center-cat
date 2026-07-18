-- ============================================================
-- إصلاح الحذف في سجل الصيانة - نفّذ في Supabase SQL Editor
-- ============================================================
-- المشكلة: لا توجد سياسة DELETE لجدول maintenance_records
-- الحل: إضافة السياسة للسماح للأدمن بالحذف
-- ============================================================

DROP POLICY IF EXISTS "maint_rec_delete_admin" ON maintenance_records;
CREATE POLICY "maint_rec_delete_admin" ON maintenance_records FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
