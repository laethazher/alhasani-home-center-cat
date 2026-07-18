-- Mirrors template allocation_mode for installation DB parity (logic enabled only for tajhiz in UI).

ALTER TABLE public.inventory_item_templates
  ADD COLUMN IF NOT EXISTS allocation_mode text;

COMMENT ON COLUMN public.inventory_item_templates.allocation_mode IS
  'NULL أو triple_named لتوسعة الواجهة؛ إدارة التجهيز لا تستخدم installation_reports لهذا الحقل الآن.';
