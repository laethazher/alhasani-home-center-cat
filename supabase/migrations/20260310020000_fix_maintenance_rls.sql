-- ============================================================
-- Fix: Replace get_jwt_role() to use auth.jwt() instead of
-- current_setting('request.jwt.claims') which is unreliable.
-- This aligns with the JWT-based RLS pattern established in
-- migration 20260302162000_jwt_based_rls.sql
-- ============================================================

CREATE OR REPLACE FUNCTION get_jwt_role() RETURNS TEXT AS $$
  SELECT coalesce(
    auth.jwt() -> 'app_metadata' ->> 'user_role',
    ''
  );
$$ LANGUAGE sql STABLE;
