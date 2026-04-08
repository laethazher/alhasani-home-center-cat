-- ============================================================
-- Operations department isolated schema (admin only)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.operations_staff_members (LIKE public.staff_members INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_vehicles (LIKE public.vehicles INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_vehicle_events (LIKE public.vehicle_events INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_exit_requests (LIKE public.exit_requests INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_maintenance_requests (LIKE public.maintenance_requests INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_maintenance_records (LIKE public.maintenance_records INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_maintenance_images (LIKE public.maintenance_images INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_spare_parts (LIKE public.spare_parts INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_spare_part_usage (LIKE public.spare_part_usage INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_periodic_maintenance (LIKE public.periodic_maintenance INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_maintenance_notifications (LIKE public.maintenance_notifications INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_driver_issue_reports (LIKE public.driver_issue_reports INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_attendance (LIKE public.attendance INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_attendance_archive (LIKE public.attendance_archive INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_attendance_activity_log (LIKE public.attendance_activity_log INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_violations (LIKE public.violations INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_reports (LIKE public.reports INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_inventory_item_templates (LIKE public.inventory_item_templates INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.operations_gate_notifications (LIKE public.gate_notifications INCLUDING ALL);

DO $$
DECLARE
  t text;
  policy_name text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'operations_staff_members',
    'operations_vehicles',
    'operations_vehicle_events',
    'operations_exit_requests',
    'operations_maintenance_requests',
    'operations_maintenance_records',
    'operations_maintenance_images',
    'operations_spare_parts',
    'operations_spare_part_usage',
    'operations_periodic_maintenance',
    'operations_maintenance_notifications',
    'operations_driver_issue_reports',
    'operations_attendance',
    'operations_attendance_archive',
    'operations_attendance_activity_log',
    'operations_violations',
    'operations_reports',
    'operations_inventory_item_templates',
    'operations_gate_notifications'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    policy_name := t || '_admin_only_select';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.get_jwt_role() = ''admin'')',
      policy_name,
      t
    );

    policy_name := t || '_admin_only_insert';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.get_jwt_role() = ''admin'')',
      policy_name,
      t
    );

    policy_name := t || '_admin_only_update';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.get_jwt_role() = ''admin'') WITH CHECK (public.get_jwt_role() = ''admin'')',
      policy_name,
      t
    );

    policy_name := t || '_admin_only_delete';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.get_jwt_role() = ''admin'')',
      policy_name,
      t
    );
  END LOOP;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('operations-maintenance-images', 'operations-maintenance-images', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "operations_maint_images_admin_select" ON storage.objects;
CREATE POLICY "operations_maint_images_admin_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'operations-maintenance-images' AND public.get_jwt_role() = 'admin');

DROP POLICY IF EXISTS "operations_maint_images_admin_insert" ON storage.objects;
CREATE POLICY "operations_maint_images_admin_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'operations-maintenance-images' AND public.get_jwt_role() = 'admin');

DROP POLICY IF EXISTS "operations_maint_images_admin_update" ON storage.objects;
CREATE POLICY "operations_maint_images_admin_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'operations-maintenance-images' AND public.get_jwt_role() = 'admin')
WITH CHECK (bucket_id = 'operations-maintenance-images' AND public.get_jwt_role() = 'admin');

DROP POLICY IF EXISTS "operations_maint_images_admin_delete" ON storage.objects;
CREATE POLICY "operations_maint_images_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'operations-maintenance-images' AND public.get_jwt_role() = 'admin');
