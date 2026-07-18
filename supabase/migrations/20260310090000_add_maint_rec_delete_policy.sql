-- ============================================================
-- Fix: Allow admin to delete maintenance_records
-- ============================================================
-- maintenance_records had no DELETE policy, so RLS blocked all deletes.
-- This caused the delete operation to fail silently (0 rows affected).
-- ============================================================

DROP POLICY IF EXISTS "maint_rec_delete_admin" ON maintenance_records;
CREATE POLICY "maint_rec_delete_admin" ON maintenance_records FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
