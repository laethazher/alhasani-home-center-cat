-- ============================================================
-- Expand recovery-related RLS to logistics role
-- ============================================================

DROP POLICY IF EXISTS "inspection_recovery_select" ON public.inspection_recovery;
CREATE POLICY "inspection_recovery_select"
ON public.inspection_recovery
FOR SELECT TO authenticated
USING (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department', 'logistics')
);

DROP POLICY IF EXISTS "inspection_recovery_insert" ON public.inspection_recovery;
CREATE POLICY "inspection_recovery_insert"
ON public.inspection_recovery
FOR INSERT TO authenticated
WITH CHECK (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department', 'logistics')
);

DROP POLICY IF EXISTS "inspection_recovery_update" ON public.inspection_recovery;
CREATE POLICY "inspection_recovery_update"
ON public.inspection_recovery
FOR UPDATE TO authenticated
USING (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department', 'logistics')
)
WITH CHECK (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department', 'logistics')
);

DROP POLICY IF EXISTS "inventory_deficit_compensations_select" ON public.inventory_deficit_compensations;
CREATE POLICY "inventory_deficit_compensations_select"
ON public.inventory_deficit_compensations
FOR SELECT TO authenticated
USING (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department', 'logistics')
);

DROP POLICY IF EXISTS "inventory_deficit_compensations_insert" ON public.inventory_deficit_compensations;
CREATE POLICY "inventory_deficit_compensations_insert"
ON public.inventory_deficit_compensations
FOR INSERT TO authenticated
WITH CHECK (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department', 'logistics')
);

DROP POLICY IF EXISTS "inventory_deficit_compensations_update" ON public.inventory_deficit_compensations;
CREATE POLICY "inventory_deficit_compensations_update"
ON public.inventory_deficit_compensations
FOR UPDATE TO authenticated
USING (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department', 'logistics')
)
WITH CHECK (
  public.get_jwt_role() IN ('admin', 'manager', 'maintenance_manager', 'installation_department', 'logistics')
);
