-- ============================================================
-- Enforce customer fields for customer compensation reasons
-- ============================================================

ALTER TABLE public.inspection_recovery_compensation_reasons
  DROP CONSTRAINT IF EXISTS inspection_recovery_reasons_customer_invoice_check;

ALTER TABLE public.inspection_recovery_compensation_reasons
  ADD CONSTRAINT inspection_recovery_reasons_customer_invoice_check
  CHECK (
    reason_category <> 'customer_compensation'
    OR (
      COALESCE(BTRIM(customer_name), '') <> ''
      AND COALESCE(BTRIM(invoice_number), '') <> ''
    )
  );
