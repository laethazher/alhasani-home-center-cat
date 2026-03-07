-- ============================================================
-- Fix: Unauthorized on Finish Maintenance + Maintenance Manager Image Upload
-- ============================================================
-- 1. finish_maintenance: Use user_profiles first, fallback to JWT role
-- 2. maintenance_images: Add fallback policy using user_profiles for role check
-- 3. Storage: Ensure any authenticated can upload to maintenance-images
-- 4. maintenance_requests: Add fallback INSERT policy for admin via user_profiles
-- 5. Backfill: Sync user_role to JWT for all users (fixes stale JWT)
-- ============================================================

-- 5. Backfill: Ensure all user_profiles have their role in auth.users.raw_app_meta_data
UPDATE auth.users u
   SET raw_app_meta_data =
       COALESCE(u.raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object('user_role', p.role)
  FROM public.user_profiles p
 WHERE u.id = p.id
   AND (u.raw_app_meta_data ->> 'user_role') IS DISTINCT FROM p.role;

CREATE OR REPLACE FUNCTION finish_maintenance(
  p_request_id BIGINT,
  p_maintenance_type TEXT,
  p_fault_description TEXT,
  p_work_done TEXT,
  p_inspection_only BOOLEAN DEFAULT false,
  p_parts_replaced TEXT DEFAULT NULL,
  p_technician_name TEXT DEFAULT NULL,
  p_cost NUMERIC DEFAULT 0,
  p_duration_minutes INT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_spare_parts JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.maintenance_requests%ROWTYPE;
  v_record_id BIGINT;
  v_spare JSONB;
  v_part_id BIGINT;
  v_qty INT;
  v_unit_cost NUMERIC;
  v_part_quantity INT;
  v_user_role TEXT;
  v_caller_id UUID;
  v_jwt_role TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized_not_logged_in');
  END IF;

  -- Get role: try user_profiles first, then fallback to JWT
  SELECT role INTO v_user_role FROM public.user_profiles WHERE id = v_caller_id;
  IF v_user_role IS NULL OR v_user_role = '' THEN
    v_jwt_role := COALESCE(NULLIF(TRIM(public.get_jwt_role()), ''), '');
    v_user_role := v_jwt_role;
  END IF;

  IF v_user_role NOT IN ('admin', 'maintenance_manager') THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized_role_' || COALESCE(v_user_role, 'none'));
  END IF;

  SELECT * INTO v_request FROM public.maintenance_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_found');
  END IF;

  IF v_request.status <> 'in_progress' THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_in_progress');
  END IF;

  IF EXISTS (SELECT 1 FROM public.maintenance_records WHERE request_id = p_request_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'duplicate_record');
  END IF;

  INSERT INTO public.maintenance_records (
    request_id, vehicle_id, maintenance_type, fault_description, work_done,
    inspection_only, parts_replaced, technician_name, cost, duration_minutes, notes
  ) VALUES (
    p_request_id, v_request.vehicle_id, p_maintenance_type, p_fault_description, p_work_done,
    p_inspection_only, p_parts_replaced, p_technician_name, p_cost, p_duration_minutes, p_notes
  )
  RETURNING id INTO v_record_id;

  FOR v_spare IN SELECT * FROM jsonb_array_elements(p_spare_parts)
  LOOP
    v_part_id := (v_spare->>'part_id')::BIGINT;
    v_qty := GREATEST(1, COALESCE((v_spare->>'quantity')::INT, 1));
    SELECT quantity, price INTO v_part_quantity, v_unit_cost FROM public.spare_parts WHERE id = v_part_id;
    IF FOUND AND v_part_quantity >= v_qty THEN
      INSERT INTO public.spare_part_usage (record_id, part_id, quantity_used, unit_cost)
      VALUES (v_record_id, v_part_id, v_qty, v_unit_cost);
      UPDATE public.spare_parts SET quantity = quantity - v_qty WHERE id = v_part_id;
    END IF;
  END LOOP;

  UPDATE public.maintenance_requests
  SET status = 'completed', finished_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.vehicle_events (vehicle_id, event_type, description, old_value, new_value)
  VALUES (
    v_request.vehicle_id,
    'status_changed',
    'صيانة مكتملة: ' || p_maintenance_type,
    'maintenance',
    'available'
  );

  UPDATE public.vehicles SET status = 'available' WHERE id = v_request.vehicle_id;

  INSERT INTO public.maintenance_notifications (vehicle_id, notification_type, title, message, target_role)
  VALUES (
    v_request.vehicle_id,
    'maintenance_completed',
    'صيانة مكتملة',
    'تم إنهاء صيانة المركبة: ' || p_maintenance_type || ' — التكلفة: ' || COALESCE(p_cost::TEXT, '0') || ' د.ع',
    'admin'
  );

  UPDATE public.maintenance_images SET record_id = v_record_id WHERE request_id = p_request_id;

  RETURN jsonb_build_object('success', true, 'record_id', v_record_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 2. maintenance_images INSERT: Add fallback policy for users whose role is in user_profiles
--    (covers cases where JWT app_metadata is stale or missing)
DROP POLICY IF EXISTS "maint_img_insert_by_profile" ON maintenance_images;
CREATE POLICY "maint_img_insert_by_profile" ON maintenance_images FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'maintenance_manager')
    )
  );

-- 3. Storage: Ensure any authenticated user can upload to maintenance-images
--    (previous policies may have been too restrictive; this is the most permissive fallback)
DROP POLICY IF EXISTS "maint_images_upload_any_auth" ON storage.objects;
CREATE POLICY "maint_images_upload_any_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'maintenance-images');

-- 4. maintenance_requests INSERT: Add fallback for admin when JWT role is missing
--    (allows request creation when user_profiles has admin role)
DROP POLICY IF EXISTS "maint_req_insert_by_profile" ON maintenance_requests;
CREATE POLICY "maint_req_insert_by_profile" ON maintenance_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
