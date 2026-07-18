-- Policy: managers can view ALL reports

CREATE POLICY "managers_can_view_all_reports"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role = 'manager'
    )
  );
