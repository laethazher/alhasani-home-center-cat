-- ============================================================
-- Installation Department Role + Admin-only delete hardening
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1) Allow new role in user_profiles constraint
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (
    role IN (
      'admin',
      'driver',
      'manager',
      'warehouse',
      'logistics',
      'gate_guard',
      'maintenance_manager',
      'installation_department'
    )
  );

-- 2) Force reports delete to admin only
DROP POLICY IF EXISTS "managers_can_delete_reports" ON public.reports;

-- 3) Force attendance-related delete to admin only
DROP POLICY IF EXISTS "attendance_archive_admin_delete" ON public.attendance_archive;
DROP POLICY IF EXISTS "attendance_archive_manager_delete" ON public.attendance_archive;
CREATE POLICY "attendance_archive_admin_delete" ON public.attendance_archive
  FOR DELETE TO authenticated
  USING (get_jwt_role() = 'admin');

DROP POLICY IF EXISTS "staff_members_admin_delete" ON public.staff_members;
DROP POLICY IF EXISTS "staff_members_manager_delete" ON public.staff_members;
CREATE POLICY "staff_members_admin_delete" ON public.staff_members
  FOR DELETE TO authenticated
  USING (get_jwt_role() = 'admin');

-- 4) Seed required installation department users
DO $$
DECLARE
  v_existing UUID;
  v_new UUID;
BEGIN
  -- User 1: Harith Qasim
  SELECT id INTO v_existing FROM auth.users WHERE email = 'harithHQ@alhasani.com';
  IF v_existing IS NULL THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated',
      'harithHQ@alhasani.com',
      extensions.crypt('123', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"],"user_role":"installation_department"}'::jsonb,
      '{}'::jsonb,
      '', '', '', ''
    )
    RETURNING id INTO v_new;

    UPDATE public.user_profiles
    SET role = 'installation_department', full_name = 'حارث قاسم'
    WHERE id = v_new;
  ELSE
    UPDATE public.user_profiles
    SET role = 'installation_department', full_name = 'حارث قاسم'
    WHERE id = v_existing;

    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || '{"user_role":"installation_department"}'::jsonb
    WHERE id = v_existing;
  END IF;

  -- User 2: Ali Wissam
  v_existing := NULL;
  v_new := NULL;
  SELECT id INTO v_existing FROM auth.users WHERE email = 'aliHC@alhasani.com';
  IF v_existing IS NULL THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated',
      'aliHC@alhasani.com',
      extensions.crypt('123', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"],"user_role":"installation_department"}'::jsonb,
      '{}'::jsonb,
      '', '', '', ''
    )
    RETURNING id INTO v_new;

    UPDATE public.user_profiles
    SET role = 'installation_department', full_name = 'علي وسام'
    WHERE id = v_new;
  ELSE
    UPDATE public.user_profiles
    SET role = 'installation_department', full_name = 'علي وسام'
    WHERE id = v_existing;

    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || '{"user_role":"installation_department"}'::jsonb
    WHERE id = v_existing;
  END IF;
END $$;
