-- ============================================================
-- Maintenance Module Overhaul
-- Phase 1: RLS restrictions for maintenance_manager, unique constraint
-- Phase 2: finish_maintenance RPC
-- ============================================================

-- 1. Clean duplicate records (keep earliest per request_id), then add unique constraint
DELETE FROM maintenance_records a
USING maintenance_records b
WHERE a.request_id IS NOT NULL AND b.request_id IS NOT NULL
  AND a.request_id = b.request_id
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_maint_rec_request_unique
  ON maintenance_records(request_id) WHERE request_id IS NOT NULL;

-- 2. Drop existing maintenance policies to replace with role-specific ones
DROP POLICY IF EXISTS "maint_req_insert" ON maintenance_requests;
DROP POLICY IF EXISTS "maint_req_update" ON maintenance_requests;
DROP POLICY IF EXISTS "maint_req_delete" ON maintenance_requests;

DROP POLICY IF EXISTS "maint_rec_insert" ON maintenance_records;
DROP POLICY IF EXISTS "maint_rec_update" ON maintenance_records;

DROP POLICY IF EXISTS "maint_img_insert" ON maintenance_images;

DROP POLICY IF EXISTS "spare_parts_insert" ON spare_parts;
DROP POLICY IF EXISTS "spare_parts_update" ON spare_parts;
DROP POLICY IF EXISTS "spare_parts_delete" ON spare_parts;

DROP POLICY IF EXISTS "spare_usage_insert" ON spare_part_usage;

-- 3. maintenance_requests: admin full access; manager can only approve/reject
CREATE POLICY "maint_req_insert_admin" ON maintenance_requests FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() = 'admin');

CREATE POLICY "maint_req_update_admin" ON maintenance_requests FOR UPDATE TO authenticated
  USING (get_jwt_role() = 'admin');

CREATE POLICY "maint_req_update_manager_approve" ON maintenance_requests FOR UPDATE TO authenticated
  USING (
    get_jwt_role() = 'maintenance_manager'
    AND status = 'pending'
  )
  WITH CHECK (status IN ('in_progress','rejected'));

CREATE POLICY "maint_req_delete_admin" ON maintenance_requests FOR DELETE TO authenticated
  USING (get_jwt_role() = 'admin');

-- 4. maintenance_records: admin only for INSERT/UPDATE/DELETE
CREATE POLICY "maint_rec_insert_admin" ON maintenance_records FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() = 'admin');

CREATE POLICY "maint_rec_update_admin" ON maintenance_records FOR UPDATE TO authenticated
  USING (get_jwt_role() = 'admin');

-- 5. maintenance_images: admin only for INSERT (manager can SELECT via existing policy)
CREATE POLICY "maint_img_insert_admin" ON maintenance_images FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() = 'admin');

-- 6. spare_parts: admin only for INSERT/UPDATE/DELETE
CREATE POLICY "spare_parts_insert_admin" ON spare_parts FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() = 'admin');

CREATE POLICY "spare_parts_update_admin" ON spare_parts FOR UPDATE TO authenticated
  USING (get_jwt_role() = 'admin');

CREATE POLICY "spare_parts_delete_admin" ON spare_parts FOR DELETE TO authenticated
  USING (get_jwt_role() = 'admin');

-- 7. spare_part_usage: admin only for INSERT
CREATE POLICY "spare_usage_insert_admin" ON spare_part_usage FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() = 'admin');

-- ============================================================
-- finish_maintenance RPC (Phase 2)
-- ============================================================

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
BEGIN
  -- Must be admin
  IF public.get_jwt_role() <> 'admin' THEN
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

-- 8. Storage: restrict maintenance image uploads to admin only
DROP POLICY IF EXISTS "maint_images_upload" ON storage.objects;
CREATE POLICY "maint_images_upload_admin" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'maintenance-images'
    AND (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin'
  );
