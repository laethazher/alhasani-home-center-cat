-- Optional barcode on installation inventory templates

ALTER TABLE public.inventory_item_templates
  ADD COLUMN IF NOT EXISTS barcode text;
