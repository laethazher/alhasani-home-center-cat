-- ============================================================
-- Crew Attendance - Archive Day RPC
-- Moves all attendance records for a given date to attendance_archive
-- ============================================================

CREATE OR REPLACE FUNCTION public.archive_attendance_day(p_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_count INT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT role INTO v_role FROM user_profiles WHERE id = v_caller_id;
  IF v_role IS NULL OR v_role = '' THEN
    v_role := COALESCE(auth.jwt() -> 'app_metadata' ->> 'user_role', '');
  END IF;
  IF LOWER(TRIM(v_role)) <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin_only');
  END IF;

  IF p_date IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_date');
  END IF;

  -- Insert into archive
  INSERT INTO attendance_archive (
    staff_id, attendance_date, attendance_type, check_in_time, check_out_time,
    notes, vehicle_id, created_by, archived_by, archived_at
  )
  SELECT staff_id, attendance_date, attendance_type, check_in_time, check_out_time,
    notes, vehicle_id, created_by, v_caller_id, now()
  FROM attendance
  WHERE attendance_date = p_date;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Delete from attendance
  DELETE FROM attendance WHERE attendance_date = p_date;

  -- Log activity
  INSERT INTO attendance_activity_log (action_type, entity_type, metadata, user_id)
  VALUES ('archive', 'attendance', jsonb_build_object('date', p_date, 'count', v_count), v_caller_id);

  RETURN jsonb_build_object('success', true, 'archived_count', v_count);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_attendance_day(DATE) TO authenticated;
