-- ============================================================
--  FIX #2: Use plpgsql to prevent function inlining.
--  PostgreSQL can inline LANGUAGE sql functions, stripping
--  the SECURITY DEFINER behaviour and causing RLS recursion.
--  plpgsql functions are NEVER inlined.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _role text;
BEGIN
  SELECT role INTO _role
    FROM public.user_profiles
   WHERE id = auth.uid();
  RETURN _role;
END;
$$;
