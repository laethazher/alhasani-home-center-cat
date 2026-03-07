-- Seed the maintenance manager user: thaer@alhasani.com / 123

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  existing_uid UUID;
  new_uid UUID;
BEGIN
  -- Check if user already exists
  SELECT id INTO existing_uid FROM auth.users WHERE email = 'thaer@alhasani.com';

  IF existing_uid IS NULL THEN
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
      extensions.crypt('123', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"],"user_role":"maintenance_manager"}'::jsonb,
      '{}'::jsonb,
      '', '', '', ''
    )
    RETURNING id INTO new_uid;

    UPDATE user_profiles
    SET role = 'maintenance_manager', full_name = 'ثائر'
    WHERE id = new_uid;
  ELSE
    UPDATE user_profiles
    SET role = 'maintenance_manager', full_name = 'ثائر'
    WHERE id = existing_uid;

    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"user_role":"maintenance_manager"}'::jsonb
    WHERE id = existing_uid;
  END IF;
END $$;
