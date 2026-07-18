-- ============================================================
-- Allow installation_department role to insert into installation_reports
-- ============================================================
-- Context:
--   The generic "write_installation_reports" FOR ALL policy (created in the
--   core schema loop) gates writes behind is_admin_like(), which does NOT
--   include the installation_department role.
--   Users with role = 'installation_department' (e.g. aliHC@alhasani.com)
--   must be able to save inspection reports from the التركيب section.
--   Solution: add a dedicated FOR INSERT policy for that role.
--   The admin-only ALL policy is intentionally preserved for UPDATE/DELETE.
-- ============================================================

DROP POLICY IF EXISTS "installation_department_insert_reports" ON public.installation_reports;

CREATE POLICY "installation_department_insert_reports"
  ON public.installation_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_role() = 'installation_department');
