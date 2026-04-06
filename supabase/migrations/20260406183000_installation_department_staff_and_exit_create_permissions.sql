-- ============================================================
-- Installation Department: allow adding technicians + creating exit requests
-- ============================================================

-- 1) installation_staff_members:
-- allow installation_department to insert new technicians/crew from attendance daily screen.
DROP POLICY IF EXISTS "installation_department_insert_staff" ON public.installation_staff_members;
CREATE POLICY "installation_department_insert_staff"
ON public.installation_staff_members FOR INSERT
TO authenticated
WITH CHECK (public.current_role() IN ('admin', 'installation_department'));

-- 2) installation_exit_requests:
-- allow installation_department to create and update own exit workflow fields.
DROP POLICY IF EXISTS "insert_installation_exit_requests" ON public.installation_exit_requests;
CREATE POLICY "insert_installation_exit_requests"
ON public.installation_exit_requests FOR INSERT
TO authenticated
WITH CHECK (public.current_role() IN ('admin', 'manager', 'gate_guard', 'installation_department'));

DROP POLICY IF EXISTS "update_installation_exit_requests" ON public.installation_exit_requests;
CREATE POLICY "update_installation_exit_requests"
ON public.installation_exit_requests FOR UPDATE
TO authenticated
USING (public.current_role() IN ('admin', 'manager', 'gate_guard', 'installation_department'))
WITH CHECK (public.current_role() IN ('admin', 'manager', 'gate_guard', 'installation_department'));
