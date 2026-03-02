-- ============================================================
--  FIX: infinite recursion in user_profiles RLS policies
--  Root cause: policies on user_profiles query user_profiles
--              to check admin/manager role → infinite loop.
--  Solution:  SECURITY DEFINER helper bypasses RLS.
-- ============================================================

-- 1) Create a helper that reads the role WITHOUT going through RLS
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

-- ────────────────────────────────────────────────────────────
-- 2) Drop ALL broken policies (on user_profiles AND reports)
-- ────────────────────────────────────────────────────────────

-- user_profiles policies
DROP POLICY IF EXISTS "users_can_view_own_profile"      ON public.user_profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile"     ON public.user_profiles;
DROP POLICY IF EXISTS "admins_can_view_all_profiles"     ON public.user_profiles;
DROP POLICY IF EXISTS "admins_can_update_all_profiles"   ON public.user_profiles;
DROP POLICY IF EXISTS "admins_can_insert_profiles"       ON public.user_profiles;

-- reports policies that also query user_profiles
DROP POLICY IF EXISTS "managers_can_view_all_reports"    ON public.reports;
DROP POLICY IF EXISTS "admins_can_view_all_reports"      ON public.reports;
DROP POLICY IF EXISTS "admins_can_update_reports"        ON public.reports;

-- ────────────────────────────────────────────────────────────
-- 3) Recreate user_profiles policies using get_my_role()
-- ────────────────────────────────────────────────────────────

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
    AND role = public.get_my_role()   -- prevents role escalation
  );

-- Admins can view ALL profiles
CREATE POLICY "admins_can_view_all_profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');

-- Admins can update ALL profiles (including role)
CREATE POLICY "admins_can_update_all_profiles"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING  (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Admins can insert profiles
CREATE POLICY "admins_can_insert_profiles"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = 'admin');

-- ────────────────────────────────────────────────────────────
-- 4) Recreate reports policies using get_my_role()
-- ────────────────────────────────────────────────────────────

-- Managers can view ALL reports
CREATE POLICY "managers_can_view_all_reports"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'manager');

-- Admins can view ALL reports
CREATE POLICY "admins_can_view_all_reports"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');

-- Admins can update ALL reports
CREATE POLICY "admins_can_update_reports"
  ON public.reports
  FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'admin');
