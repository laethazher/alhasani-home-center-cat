-- ============================================================
-- inspection_recovery: Snapshot + Live template linkage
-- ============================================================
-- يُضيف ثلاثة أعمدة لحفظ لقطة (snapshot) لاسم العنصر والباركود وقت إنشاء
-- صف نواقص الجرد، بالإضافة إلى مرجع القالب الحالي (template_id) كي يتمكّن
-- العرض في الأرشيف من إظهار الاسم وقت التقرير جنباً إلى جنب مع الاسم الحالي
-- إذا تغيّر اسم/باركود العنصر لاحقاً في inventory_item_templates.
--
-- التصميم:
--   - الأعمدة قابلة للفراغ (NULL) لضمان عدم كسر أي صفوف تاريخية.
--   - ليس لدينا FOREIGN KEY صارم على template_id لأن القالب قد يُعاد
--     ترقيمه في بعض البيئات؛ نعتمد على الفهرسة فقط.
--   - عملية backfill: ملء snapshot من item_name الحالي للصفوف القديمة
--     حتى يتطابق سلوك العرض قبل وبعد الترحيل.
-- ============================================================

ALTER TABLE public.inspection_recovery
  ADD COLUMN IF NOT EXISTS item_name_snapshot text,
  ADD COLUMN IF NOT EXISTS item_barcode_snapshot text,
  ADD COLUMN IF NOT EXISTS template_id bigint;

-- Backfill: ضبط snapshot للصفوف القديمة حتى تبقى متوافقة مع عروض الأرشيف.
UPDATE public.inspection_recovery
SET item_name_snapshot = item_name
WHERE item_name_snapshot IS NULL;

-- فهرس مساعد للبحث السريع بالـ template_id (البحث الذكي + عروض المركبة).
CREATE INDEX IF NOT EXISTS idx_inspection_recovery_template_id
  ON public.inspection_recovery (template_id);

-- فهرس مركّب لتسريع جلب آخر نواقص مركبة لعنصر معيّن.
CREATE INDEX IF NOT EXISTS idx_inspection_recovery_vehicle_template_created
  ON public.inspection_recovery (vehicle_id, template_id, created_at DESC);

COMMENT ON COLUMN public.inspection_recovery.item_name_snapshot IS
  'لقطة لاسم العنصر وقت إنشاء صف نواقص الجرد — تُستخدم لعرض التقارير التاريخية في الأرشيف بدقة.';
COMMENT ON COLUMN public.inspection_recovery.item_barcode_snapshot IS
  'لقطة لباركود العنصر وقت إنشاء صف نواقص الجرد.';
COMMENT ON COLUMN public.inspection_recovery.template_id IS
  'مرجع للقالب الحالي في inventory_item_templates للسماح بقراءة الاسم/الباركود الحي عند العرض في الواجهات.';
