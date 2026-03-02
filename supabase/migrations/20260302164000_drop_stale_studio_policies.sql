-- Drop stale policies created via Supabase Studio
-- These cause infinite recursion and duplicate our migration-managed policies.

DROP POLICY IF EXISTS "user_profiles: select all (admin)" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles: select own"         ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles: update own name"    ON public.user_profiles;

-- Cleanup: remove the temporary debug function
DROP FUNCTION IF EXISTS public.debug_list_policies();
