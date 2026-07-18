-- ============================================================
-- Migration: Add exit_type and exit_duration_minutes
-- exit_type: 'permanent' or 'temporary'
-- exit_duration_minutes: duration in minutes for temporary exits
-- Also make driver_id nullable (assistant-only exits)
-- ============================================================

ALTER TABLE public.exit_requests
  ADD COLUMN IF NOT EXISTS exit_type TEXT NOT NULL DEFAULT 'permanent'
    CHECK (exit_type IN ('permanent', 'temporary')),
  ADD COLUMN IF NOT EXISTS exit_duration_minutes INT;

-- Make driver_id and driver_name nullable for assistant-only exits
ALTER TABLE public.exit_requests
  ALTER COLUMN driver_id DROP NOT NULL,
  ALTER COLUMN driver_name DROP NOT NULL;

-- Set default for driver_name to empty string for old nulls
ALTER TABLE public.exit_requests
  ALTER COLUMN driver_name SET DEFAULT '';
