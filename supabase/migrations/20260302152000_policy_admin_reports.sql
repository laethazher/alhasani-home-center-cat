-- Admin policies on reports: SELECT + UPDATE

CREATE POLICY "admins_can_view_all_reports"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "admins_can_update_reports"
  ON public.reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );
