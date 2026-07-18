-- ============================================================
-- Fix: Broaden permissions for maintenance_manager to avoid "unauthorized"
-- ============================================================

-- 1. Ensure maintenance_manager can SELECT spare_parts (needed for the form)
-- (Existing policy spare_parts_select might already allow it, but let's be sure)
DROP POLICY IF EXISTS "spare_parts_select_manager" ON spare_parts;
CREATE POLICY "spare_parts_select_manager" ON spare_parts FOR SELECT TO authenticated
  USING (true); -- Everyone authenticated can see spare parts

-- 2. Ensure maintenance_manager can UPDATE maintenance_requests to 'completed'
-- (Existing policy maint_req_update_manager_approve only allowed pending -> in_progress/rejected)
DROP POLICY IF EXISTS "maint_req_update_manager_finish" ON maintenance_requests;
CREATE POLICY "maint_req_update_manager_finish" ON maintenance_requests FOR UPDATE TO authenticated
  USING (
    get_jwt_role() = 'maintenance_manager'
  )
  WITH CHECK (
    status IN ('in_progress', 'rejected', 'completed')
  );

-- 3. Ensure maintenance_manager can update vehicles status (needed by RPC)
DROP POLICY IF EXISTS "vehicles_update_maint_manager" ON vehicles;
CREATE POLICY "vehicles_update_maint_manager" ON vehicles FOR UPDATE TO authenticated
  USING (get_jwt_role() IN ('admin', 'maintenance_manager'));

-- 4. Ensure maintenance_manager can insert vehicle_events (needed by RPC)
DROP POLICY IF EXISTS "vehicle_events_insert_maint_manager" ON vehicle_events;
CREATE POLICY "vehicle_events_insert_maint_manager" ON vehicle_events FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() IN ('admin', 'maintenance_manager'));

-- 5. Ensure maintenance_manager can insert notifications (needed by RPC)
DROP POLICY IF EXISTS "maint_notif_insert_maint_manager" ON maintenance_notifications;
CREATE POLICY "maint_notif_insert_maint_manager" ON maintenance_notifications FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() IN ('admin', 'maintenance_manager'));

-- 6. Ensure maintenance_manager can update spare_parts quantity (needed by RPC)
DROP POLICY IF EXISTS "spare_parts_update_maint_manager" ON spare_parts;
CREATE POLICY "spare_parts_update_maint_manager" ON spare_parts FOR UPDATE TO authenticated
  USING (get_jwt_role() IN ('admin', 'maintenance_manager'));

-- 7. Ensure maintenance_manager can insert spare_part_usage (needed by RPC)
DROP POLICY IF EXISTS "spare_usage_insert_maint_manager" ON spare_part_usage;
CREATE POLICY "spare_usage_insert_maint_manager" ON spare_part_usage FOR INSERT TO authenticated
  WITH CHECK (get_jwt_role() IN ('admin', 'maintenance_manager'));
