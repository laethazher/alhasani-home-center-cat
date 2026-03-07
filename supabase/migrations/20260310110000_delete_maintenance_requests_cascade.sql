-- ============================================================
-- Cascade delete for maintenance_requests (request-centric).
-- Deletes records, images, spare_part_usage, vehicle_events,
-- maintenance_notifications. Admin only.
-- ============================================================

CREATE OR REPLACE FUNCTION delete_maintenance_requests(p_request_ids BIGINT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_record_ids BIGINT[];
  v_result JSONB;
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

  IF p_request_ids IS NULL OR array_length(p_request_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_ids');
  END IF;

  -- Get record IDs linked to these requests
  SELECT COALESCE(array_agg(id), '{}') INTO v_record_ids
  FROM maintenance_records
  WHERE request_id = ANY(p_request_ids);

  -- Use delete_maintenance_records for requests that have records
  IF v_record_ids IS NOT NULL AND array_length(v_record_ids, 1) > 0 THEN
    v_result := delete_maintenance_records(v_record_ids);
    IF (v_result->>'success')::boolean = false THEN
      RETURN v_result;
    END IF;
  END IF;

  -- Delete requests that have no records (e.g. newly created pending)
  DELETE FROM maintenance_requests WHERE id = ANY(p_request_ids);

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_maintenance_requests TO authenticated;
