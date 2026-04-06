-- ============================================================
-- Installation Department: Maintenance request + attendance archive access
-- ============================================================

-- 1) installation maintenance requests write policy:
-- allow installation_department to create/manage requests in installation tables.
DROP POLICY IF EXISTS "write_maintenance_tables" ON public.installation_maintenance_requests;
CREATE POLICY "write_maintenance_tables"
ON public.installation_maintenance_requests FOR ALL
USING (public.current_role() IN ('admin', 'maintenance_manager', 'manager', 'installation_department'))
WITH CHECK (public.current_role() IN ('admin', 'maintenance_manager', 'manager', 'installation_department'));

-- 2) installation attendance write policy:
-- allow installation_department to save daily attendance.
DROP POLICY IF EXISTS "write_installation_attendance" ON public.installation_attendance;
CREATE POLICY "write_installation_attendance"
ON public.installation_attendance FOR ALL
USING (public.current_role() IN ('admin', 'manager', 'installation_department'))
WITH CHECK (public.current_role() IN ('admin', 'manager', 'installation_department'));

-- 3) installation archive attendance RPC:
-- allow installation_department to archive day in installation workspace.
CREATE OR REPLACE FUNCTION public.installation_archive_attendance_day(p_day date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moved_count int := 0;
BEGIN
  IF public.current_role() NOT IN ('admin', 'manager', 'installation_department') THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  INSERT INTO public.installation_attendance_archive (
    staff_id, attendance_date, attendance_type, check_in_time, check_out_time,
    notes, vehicle_id, created_by, archived_by, archived_at
  )
  SELECT
    staff_id, attendance_date, attendance_type, check_in_time, check_out_time,
    notes, vehicle_id, created_by, auth.uid(), now()
  FROM public.installation_attendance
  WHERE attendance_date = p_day;

  GET DIAGNOSTICS moved_count = ROW_COUNT;

  DELETE FROM public.installation_attendance WHERE attendance_date = p_day;

  RETURN jsonb_build_object('success', true, 'archived_count', moved_count, 'day', p_day);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', sqlerrm);
END;
$$;

GRANT EXECUTE ON FUNCTION public.installation_archive_attendance_day(date) TO authenticated;
