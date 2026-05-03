-- ============================================================
-- Tajhiz / shared templates: triple_named holders (driver + 2 assistants)
-- reports: persisted holder allocation JSON (Tajhiz insert path uses public.reports)
-- ============================================================

ALTER TABLE public.inventory_item_templates
  ADD COLUMN IF NOT EXISTS allocation_mode text;

COMMENT ON COLUMN public.inventory_item_templates.allocation_mode IS
  'NULL = عدد واحد؛ triple_named = 1 سائق + 2 مساعد (المطلوب 3) — يُطبَّق المنطق في department=tajhiz فقط من الواجهة.';

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS tool_holder_allocations jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.reports.tool_holder_allocations IS
  'توزيع حوازين العُدّة لكل template_id؛ مفاتيح نصية + مصفوفة {slot, staffId, label} — قسم التجهيز.';

DO $$
BEGIN
  IF to_regclass('public.operations_inventory_item_templates') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.operations_inventory_item_templates ADD COLUMN IF NOT EXISTS allocation_mode text';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.operations_reports') IS NOT NULL THEN
    EXECUTE $ops$
      ALTER TABLE public.operations_reports
        ADD COLUMN IF NOT EXISTS tool_holder_allocations jsonb NOT NULL DEFAULT '{}'::jsonb
    $ops$;
  END IF;
END $$;
