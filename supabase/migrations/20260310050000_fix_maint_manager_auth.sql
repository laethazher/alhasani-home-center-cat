-- ============================================================
-- Fix: Grant maintenance_manager permissions for finishing maintenance
-- and uploading images (fixing "unauthorized" error)
-- ============================================================

-- 1. Update finish_maintenance RPC to allow maintenance_manager
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
  v_role TEXT;
BEGIN
  -- Get role
  v_role := public.get_jwt_role();

  -- Must be admin or maintenance_manager
  IF v_role NOT IN ('admin', 'maintenance_manager') THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Get request
  SELECT * INTO v_request FROM public.maintenance_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_found');
  END IF;

  IF v_request.status <> 'in_progress' THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_in_progress');
  END IF;

  -- Check no duplicate record
  IF EXISTS (SELECT 1 FROM public.maintenance_records WHERE request_id = p_request_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'duplicate_record');
  END IF;

  -- 1. Insert maintenance_record
  INSERT INTO public.maintenance_records (
    request_id, vehicle_id, maintenance_type, fault_description, work_done,
    inspection_only, parts_replaced, technician_name, cost, duration_minutes, notes
  ) VALUES (
    p_request_id, v_request.vehicle_id, p_maintenance_type, p_fault_description, p_work_done,
    p_inspection_only, p_parts_replaced, p_technician_name, p_cost, p_duration_minutes, p_notes
  )
  RETURNING id INTO v_record_id;

  -- 2. Spare part usage
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

  -- 3. Update maintenance_requests
  UPDATE public.maintenance_requests
  SET status = 'completed', finished_at = now()
  WHERE id = p_request_id;

  -- 4. Vehicle event
  INSERT INTO public.vehicle_events (vehicle_id, event_type, description, old_value, new_value)
  VALUES (
    v_request.vehicle_id,
    'status_changed',
    'صيانة مكتملة: ' || p_maintenance_type,
    'maintenance',
    'available'
  );

  -- 5. Update vehicle status
  UPDATE public.vehicles SET status = 'available' WHERE id = v_request.vehicle_id;

  -- 6. Notification
  INSERT INTO public.maintenance_notifications (vehicle_id, notification_type, title, message, target_role)
  VALUES (
    v_request.vehicle_id,
    'maintenance_completed',
    'صيانة مكتملة',
    'تم إنهاء صيانة المركبة: ' || p_maintenance_type || ' — التكلفة: ' || COALESCE(p_cost::TEXT, '0') || ' د.ع',
    'admin'
  );

  -- 7. Link images to record
  UPDATE public.maintenance_images SET record_id = v_record_id WHERE request_id = p_request_id;

  RETURN jsonb_build_object('success', true, 'record_id', v_record_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 2. Update RLS policies for maintenance_records & images
DROP POLICY IF EXISTS "maint_rec_insert_admin" ON maintenance_records;
CREATE POLICY "maint_rec_insert_admin_manager" ON maintenance_records FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() IN ('admin', 'maintenance_manager'));

DROP POLICY IF EXISTS "maint_img_insert_admin" ON maintenance_images;
CREATE POLICY "maint_img_insert_admin_manager" ON maintenance_images FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() IN ('admin', 'maintenance_manager'));

-- 3. Update Storage policy for maintenance-images bucket
DROP POLICY IF EXISTS "maint_images_upload_admin" ON storage.objects;
CREATE POLICY "maint_images_upload_admin_manager" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'maintenance-images'
    AND (auth.jwt() -> 'app_metadata' ->> 'user_role') IN ('admin', 'maintenance_manager')
  );
