-- Seed the maintenance manager user: thaer@alhasani.com / 123
-- The trigger handle_new_user will auto-create user_profiles with role='driver'.
-- We then update to maintenance_manager.

DO $$
DECLARE
  new_uid UUID;
BEGIN
  -- Create auth user (Supabase stores passwords as bcrypt via auth.users)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'thaer@alhasani.com',
    crypt('123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"],"user_role":"maintenance_manager"}'::jsonb,
    '{}'::jsonb,
    '', '', '', ''
  )
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO new_uid;

  -- Update profile if user was just created
  IF new_uid IS NOT NULL THEN
    UPDATE user_profiles
    SET role = 'maintenance_manager', full_name = 'ثائر'
    WHERE id = new_uid;
  ELSE
    -- User already exists, just update the role
    UPDATE user_profiles
    SET role = 'maintenance_manager', full_name = 'ثائر'
    WHERE id = (SELECT id FROM auth.users WHERE email = 'thaer@alhasani.com');

    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data || '{"user_role":"maintenance_manager"}'::jsonb
    WHERE email = 'thaer@alhasani.com';
  END IF;
END $$;
