-- ============================================================
--  DEFINITIVE FIX: JWT-based role checking
--
--  Problem: ANY function/subquery that touches user_profiles
--           inside a policy ON user_profiles causes infinite
--           recursion — even with SECURITY DEFINER.
--
--  Solution: Store app role in auth.users.raw_app_meta_data
--            and read it from the JWT via auth.jwt().
--            This eliminates ALL self-referencing queries.
-- ============================================================

-- ── 1) Drop ALL policies FIRST (they depend on get_my_role) ─
-- user_profiles
DROP POLICY IF EXISTS "users_can_view_own_profile"      ON public.user_profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile"     ON public.user_profiles;
DROP POLICY IF EXISTS "admins_can_view_all_profiles"     ON public.user_profiles;
DROP POLICY IF EXISTS "admins_can_update_all_profiles"   ON public.user_profiles;
DROP POLICY IF EXISTS "admins_can_insert_profiles"       ON public.user_profiles;

-- reports
DROP POLICY IF EXISTS "managers_can_view_all_reports"    ON public.reports;
DROP POLICY IF EXISTS "admins_can_view_all_reports"      ON public.reports;
DROP POLICY IF EXISTS "admins_can_update_reports"        ON public.reports;

-- ── 2) Now safe to drop the helper function ────────────────
DROP FUNCTION IF EXISTS public.get_my_role();

-- ── 3) Update handle_new_user trigger to also write role ──
--       into raw_app_meta_data so the JWT carries it.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Create profile row
  INSERT INTO public.user_profiles (id, full_name, role, created_at)
  VALUES (NEW.id, '', 'driver', now());

  -- Sync role into app_metadata so JWT carries it
  UPDATE auth.users
     SET raw_app_meta_data =
         COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"user_role":"driver"}'::jsonb
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── 5) Create a trigger that syncs role changes on
--       user_profiles back to auth.users.raw_app_meta_data ──
CREATE OR REPLACE FUNCTION public.sync_role_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE auth.users
     SET raw_app_meta_data =
         COALESCE(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('user_role', NEW.role)
   WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_role_change ON public.user_profiles;
CREATE TRIGGER on_profile_role_change
  AFTER UPDATE OF role ON public.user_profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.sync_role_to_jwt();

-- ── 6) Backfill: set raw_app_meta_data for ALL existing users ──
UPDATE auth.users u
   SET raw_app_meta_data =
       COALESCE(u.raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object('user_role', p.role)
  FROM public.user_profiles p
 WHERE u.id = p.id;

-- ── 7) Recreate user_profiles policies using JWT claim ─────
-- Helper expression: (auth.jwt() -> 'app_metadata' ->> 'user_role')

-- Users can view their own profile
CREATE POLICY "users_can_view_own_profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile but CANNOT change role
CREATE POLICY "users_can_update_own_profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (
      -- Must match current JWT role to prevent self-escalation
      auth.jwt() -> 'app_metadata' ->> 'user_role'
    )
  );

-- Admins can view ALL profiles
CREATE POLICY "admins_can_view_all_profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin'
  );

-- Admins can update ALL profiles (including role)
CREATE POLICY "admins_can_update_all_profiles"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin'
  );

-- Admins can insert profiles
CREATE POLICY "admins_can_insert_profiles"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin'
  );

-- ── 8) Recreate reports policies using JWT claim ───────────

-- Managers can view ALL reports
CREATE POLICY "managers_can_view_all_reports"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'manager'
  );

-- Admins can view ALL reports
CREATE POLICY "admins_can_view_all_reports"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin'
  );

-- Admins can update ALL reports
CREATE POLICY "admins_can_update_reports"
  ON public.reports
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin'
  );
