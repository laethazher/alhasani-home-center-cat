-- ============================================================
-- Complete cascade delete for maintenance: records, requests,
-- images, spare_part_usage, vehicle_events, maintenance_notifications
-- Admin only. Does not affect system software or other data.
-- ============================================================

CREATE OR REPLACE FUNCTION delete_maintenance_records(p_record_ids BIGINT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_rec RECORD;
  v_vehicle_ids BIGINT[] := '{}';
  v_req_ids BIGINT[] := '{}';
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

  IF p_record_ids IS NULL OR array_length(p_record_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_ids');
  END IF;

  -- Collect vehicle_ids and request_ids from records
  FOR v_rec IN
    SELECT id, vehicle_id, request_id, maintenance_type, created_at
    FROM maintenance_records
    WHERE id = ANY(p_record_ids)
  LOOP
    v_vehicle_ids := array_append(v_vehicle_ids, v_rec.vehicle_id);
    IF v_rec.request_id IS NOT NULL THEN
      v_req_ids := array_append(v_req_ids, v_rec.request_id);
    END IF;

    -- Delete vehicle_events created by finish_maintenance (match by description pattern)
    DELETE FROM vehicle_events
    WHERE vehicle_id = v_rec.vehicle_id
      AND event_type = 'status_changed'
      AND description LIKE 'صيانة مكتملة%'
      AND created_at >= v_rec.created_at - interval '2 seconds'
      AND created_at <= v_rec.created_at + interval '2 seconds';

    -- Delete maintenance_notifications for this completion
    DELETE FROM maintenance_notifications
    WHERE vehicle_id = v_rec.vehicle_id
      AND notification_type = 'maintenance_completed'
      AND created_at >= v_rec.created_at - interval '2 seconds'
      AND created_at <= v_rec.created_at + interval '2 seconds';
  END LOOP;

  -- Delete maintenance_requests (CASCADE deletes records, images, spare_part_usage)
  IF array_length(v_req_ids, 1) > 0 THEN
    DELETE FROM maintenance_requests WHERE id = ANY(v_req_ids);
  END IF;

  -- Delete orphan records (no request_id)
  DELETE FROM maintenance_records
  WHERE id = ANY(p_record_ids)
    AND request_id IS NULL;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_maintenance_records TO authenticated;
