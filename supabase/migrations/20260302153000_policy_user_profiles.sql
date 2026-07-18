-- Strict policies for user_profiles

-- 1) Users can view their own profile only
CREATE POLICY "users_can_view_own_profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 2) Users can update their own profile but CANNOT change role
CREATE POLICY "users_can_update_own_profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT up.role FROM public.user_profiles up WHERE up.id = auth.uid())
  );

-- 3) Admins can view all profiles
CREATE POLICY "admins_can_view_all_profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );
