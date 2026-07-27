-- ============================================================================
--  installation_admin  (موظف تجهيز اداري)  — ADDITIVE grants
--  Run once in the Supabase SQL Editor. Idempotent (safe to re-run).
--
--  GUARANTEES (by construction):
--   * PURELY ADDITIVE — widens the role CHECK by ONE value and adds ONLY
--     SELECT/INSERT/UPDATE policies named ia_*. It modifies NO existing policy
--     and changes NO existing role's access.
--   * NO DELETE anywhere — creates zero DELETE policies and zero FOR ALL
--     policies (a FOR ALL would implicitly grant delete).
--   * User Management stays out of reach — user_profiles is NOT in the grant
--     list, so installation_admin gets no write access to profiles/roles.
--   * Excluded: user_profiles, all operations_*, all installation_*, and
--     _prisma_migrations (internal).
-- ============================================================================

BEGIN;

-- 1) Allow 'installation_admin' as a valid role value (additive: widens allow-list only).
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role = ANY (ARRAY[
    'admin','driver','manager','warehouse','logistics',
    'gate_guard','maintenance_manager','installation_department','installation_admin'
  ]));

-- 2) Additive granular RLS for installation_admin on every Tajheez table
--    (SELECT / INSERT / UPDATE only — never DELETE, never FOR ALL).
DO $$
DECLARE
  t text;
  tajhiz_tables text[] := ARRAY[
    'attendance','attendance_activity_log','attendance_archive',
    'bubbles_daily_snapshots','bubbles_records','bubbles_records_archive',
    'driver_issue_reports','exit_requests','gate_notifications',
    'inspection_recovery','inspection_recovery_actions',
    'inspection_recovery_compensation_reasons','inventory_deficit_compensations',
    'inventory_item_templates',
    'maintenance_images','maintenance_notifications','maintenance_records','maintenance_requests',
    'periodic_maintenance','reports','spare_part_usage','spare_parts','staff_members',
    'vehicle_events','vehicle_maintenance','vehicles','violations'
  ];
BEGIN
  FOREACH t IN ARRAY tajhiz_tables LOOP
    -- idempotency: drop our own policies first
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ia_select_'||t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ia_insert_'||t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ia_update_'||t, t);
    -- create additive SELECT / INSERT / UPDATE (no DELETE, no ALL)
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (get_jwt_role() = ''installation_admin'')',
      'ia_select_'||t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (get_jwt_role() = ''installation_admin'')',
      'ia_insert_'||t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (get_jwt_role() = ''installation_admin'') WITH CHECK (get_jwt_role() = ''installation_admin'')',
      'ia_update_'||t, t);
  END LOOP;
END $$;

COMMIT;

-- 3) VERIFICATION (results appear in the SQL Editor output) -------------------
-- Expect: ia_policies = 81, delete_or_all = 0
SELECT
  count(*)                                        AS ia_policies_created,
  count(*) FILTER (WHERE cmd = 'DELETE')          AS delete_policies_must_be_0,
  count(*) FILTER (WHERE cmd = 'ALL')             AS for_all_policies_must_be_0,
  count(DISTINCT tablename)                        AS tables_covered_expect_27
FROM pg_policies
WHERE schemaname = 'public' AND policyname LIKE 'ia\_%';

-- Confirm the role CHECK now includes installation_admin, and user_profiles was untouched:
SELECT pg_get_constraintdef(oid) AS role_check_now
FROM pg_constraint WHERE conname = 'user_profiles_role_check';

SELECT count(*) AS user_profiles_ia_policies_must_be_0
FROM pg_policies
WHERE schemaname='public' AND tablename='user_profiles' AND policyname LIKE 'ia\_%';
