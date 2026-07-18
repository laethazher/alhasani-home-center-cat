-- Policy: allow authenticated users to INSERT their own reports only

CREATE POLICY "drivers_can_insert_own_reports"
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
