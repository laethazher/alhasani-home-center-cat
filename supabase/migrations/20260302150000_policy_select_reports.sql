-- Policy: allow authenticated users to SELECT only their own reports

CREATE POLICY "drivers_can_view_own_reports"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
