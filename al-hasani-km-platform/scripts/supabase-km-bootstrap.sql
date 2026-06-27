-- =============================================================================
-- 1) إنشاء schema العزل لمنصّة المعرفة (آمن — لا يلمس public)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS km;

-- =============================================================================
-- 2) إصلاح trigger المتعلّمين (الحد الأدنى على public — بموافقة التنفيذ)
--    يمنع إنشاء user_profiles بدور driver عند التسجيل الذاتي km_role=learner
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'km_role', '') = 'learner' THEN
    UPDATE auth.users
       SET raw_app_meta_data =
           COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"user_role":"learner"}'::jsonb
     WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.user_profiles (id, full_name, role, created_at)
  VALUES (NEW.id, '', 'driver', now());

  UPDATE auth.users
     SET raw_app_meta_data =
         COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"user_role":"driver"}'::jsonb
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- Rollback (إن لزم):
-- DROP SCHEMA km CASCADE;
-- =============================================================================
