-- ============================================================
-- Fix Admin Role - Run this in Supabase SQL Editor if you get
-- "unauthorized" when finishing maintenance.
-- ============================================================
-- This ensures your admin user has correct role in user_profiles
-- and auth.users.raw_app_meta_data.
-- Replace 'YOUR_ADMIN_EMAIL' with your actual admin email.
-- ============================================================

-- Option 1: Fix by email - replace with your admin email
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'YOUR_ADMIN_EMAIL';  -- <<<< CHANGE THIS
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NOT NULL THEN
    -- Ensure user_profiles row exists with admin role
    INSERT INTO public.user_profiles (id, full_name, role, created_at)
    VALUES (v_user_id, COALESCE((SELECT full_name FROM public.user_profiles WHERE id = v_user_id), ''), 'admin', now())
    ON CONFLICT (id) DO UPDATE SET role = 'admin';
    
    -- Sync role to JWT
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"user_role":"admin"}'::jsonb
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Fixed admin role for user %', v_email;
  ELSE
    RAISE NOTICE 'User not found with email: %', v_email;
  END IF;
END $$;

-- Option 2: Create user_profiles for any auth.users that don't have one
INSERT INTO public.user_profiles (id, full_name, role, created_at)
SELECT u.id, '', COALESCE(u.raw_app_meta_data->>'user_role', 'driver'), now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = u.id);
