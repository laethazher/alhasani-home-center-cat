-- ============================================================
-- Partial compensation support (Additive)
-- ============================================================

ALTER TABLE public.inspection_recovery
  ADD COLUMN IF NOT EXISTS compensated_qty integer NOT NULL DEFAULT 0 CHECK (compensated_qty >= 0);

ALTER TABLE public.inspection_recovery_actions
  ADD COLUMN IF NOT EXISTS compensated_qty integer CHECK (compensated_qty >= 0);
