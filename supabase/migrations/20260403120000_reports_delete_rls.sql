-- السماح بحذف تقارير الفحص (تجهيز) لمن يطابق واجهة Reports.tsx: admin + manager
-- بدون هذه السياسات كان FOR DELETE مرفوضاً بالكامل بسبب RLS.

DROP POLICY IF EXISTS "admins_can_delete_reports" ON public.reports;
CREATE POLICY "admins_can_delete_reports"
  ON public.reports
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin'
  );

DROP POLICY IF EXISTS "managers_can_delete_reports" ON public.reports;
CREATE POLICY "managers_can_delete_reports"
  ON public.reports
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'manager'
  );
