-- Temporary: list all policies on user_profiles
CREATE OR REPLACE FUNCTION public.debug_list_policies()
RETURNS TABLE(policy_name text, command text, permissive text, qual text, with_check text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT policyname::text, cmd::text, permissive::text, qual::text, with_check::text
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'user_profiles';
$$;
