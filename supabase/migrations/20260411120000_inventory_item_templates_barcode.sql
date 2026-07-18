-- Optional barcode on inventory templates (tajhiz / installation / operations mirror)

ALTER TABLE public.inventory_item_templates
  ADD COLUMN IF NOT EXISTS barcode text;

DO $$
BEGIN
  IF to_regclass('public.operations_inventory_item_templates') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.operations_inventory_item_templates ADD COLUMN IF NOT EXISTS barcode text';
  END IF;
END $$;
