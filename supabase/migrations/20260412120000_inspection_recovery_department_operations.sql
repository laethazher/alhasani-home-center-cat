-- Allow operations department in inspection recovery (isolated operations workspace)

ALTER TABLE public.inspection_recovery
  DROP CONSTRAINT IF EXISTS inspection_recovery_department_check;

ALTER TABLE public.inspection_recovery
  ADD CONSTRAINT inspection_recovery_department_check
  CHECK (department IN ('tajhiz', 'installation', 'operations'));

ALTER TABLE public.inspection_recovery_actions
  DROP CONSTRAINT IF EXISTS inspection_recovery_actions_department_check;

ALTER TABLE public.inspection_recovery_actions
  ADD CONSTRAINT inspection_recovery_actions_department_check
  CHECK (department IN ('tajhiz', 'installation', 'operations'));
