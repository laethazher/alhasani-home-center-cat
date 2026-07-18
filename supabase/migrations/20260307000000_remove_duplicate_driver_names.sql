-- ============================================================
-- Migration: Remove Duplicate Driver Names
-- يحذف الأسماء المتكررة للسائقين ويوحد المراجع
-- ============================================================

-- 1) إنشاء جدول مؤقت لتخزين التطابقات بين الأسماء المتكررة
-- القائمة تحتوي على الأسماء المتكررة: (اسم_مكرر -> اسم_محفوظ)
CREATE TEMP TABLE driver_name_mapping (
  duplicate_name TEXT,
  keep_name TEXT
);

-- إدراج التطابقات المعروفة (الاسم المكرر -> الاسم الكامل المحفوظ)
INSERT INTO driver_name_mapping (duplicate_name, keep_name) VALUES
  -- من ملف PDF إلى ملف seed الأول (الاحتفاظ بالاسم الأكثر اكتمالاً)
  ('على عبد الله جيل', 'علي عبد الله جبل'),
  ('بسام على عكاب', 'بسام علي عكاب'),
  ('سيف الفقار راضي', 'سيف الفقار راضي جبار'),
  ('على الكرم', 'علي اكرم علي'),
  ('رائد قائم', 'رائد غانم حسب الله'),
  ('ثابت محمد منشد', 'ثابت محمد منشد مشهد'),
  ('حسام عبد الرحيم', 'حسام عبد الرحيم عوده'),
  ('پاسین سلیم کریم', 'ياسين سليم كريم'),
  ('مصطفی محمد سلمان', 'مصطفى محمد سلمان سبتي'),
  ('عمار فارس کامل', 'عمار فارس كامل'),
  ('نزار فالح خضير', 'نزار فالح خضير عبيد'),
  ('ایوب احمد حامد', 'ايوب احمد حامد حسين'),
  ('على محمد جواد', 'علي محمد جواد عزيز'),
  ('محمد عدنان عبد', 'محمد عدنان عبد رشيد'),
  ('احمد رفاعی', 'احمد رفاعي عايد دعيبل'),
  ('بشار جاسم عکاب', 'بشار جاسم عكاب'),
  ('محمد صالح صاحب', 'محمد صالح صاحب/نجف/سائق'),
  ('فراس حسن حمد', 'فراس حسن حمد/نجف/سائق'),
  ('ليث عماد صباح', 'ليث عماد صباح/انبار'),
  ('عمار احمد', 'عمار احمد خاجي'),
  ('عباس خالد هادي', 'عباس خالد هادي/بابل/سائق'),
  ('محمد ضياء الدين', 'محمد ضياء الدين محمد/بابل'),
  ('حسن مالك هاشم', 'حسين مالك هاشم/كوت'),
  ('بیشره و كريم احمد', 'بيشره وكريم محمد/اربيل'),
  ('بسام شاکر مجید', 'بسام شاكر مجيد/اربيل'),
  ('محمد ابراهيم احمد', 'محمد ابراهيم احمد/اربيل'),
  ('جهاد باسم محمد.', 'حيدر باسم محمد/كربلاء'),
  ('على حکمت عبيد', 'علي حسين خلف'),
  ('على حسين خلف', 'علي حسين خلف'),
  ('امجد احمد', 'امجد احمد حميد/بابل/سائق');

-- اختيار السجل المحفوظ لكل زوج أسماء:
-- 1) تفضيل السجل المرتبط فعلياً بمركبة
-- 2) عند التعادل، تفضيل keep_name المعرفة في الخريطة
-- 3) عند التعادل النهائي، تفضيل أصغر id
CREATE TEMP TABLE canonical_driver_choice AS
SELECT
  ranked.duplicate_name,
  ranked.keep_name,
  ranked.keep_id,
  ranked.keep_actual_name
FROM (
  SELECT
    dnm.duplicate_name,
    dnm.keep_name,
    sm.id AS keep_id,
    sm.full_name AS keep_actual_name,
    ROW_NUMBER() OVER (
      PARTITION BY dnm.duplicate_name
      ORDER BY
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM public.vehicles v
            WHERE v.assigned_driver_id = sm.id::text
               OR CAST(v.assigned_driver_id AS BIGINT) = sm.id
          ) THEN 0
          ELSE 1
        END,
        CASE WHEN sm.full_name = dnm.keep_name THEN 0 ELSE 1 END,
        sm.id
    ) AS rn
  FROM driver_name_mapping dnm
  JOIN public.staff_members sm
    ON sm.role = 'driver'
   AND sm.full_name IN (dnm.duplicate_name, dnm.keep_name)
) ranked
WHERE ranked.rn = 1;

-- 2) تحديث المراجع في جدول vehicles
-- تحويل أي سجل مكرر غير محفوظ إلى السجل الذي تم اختياره لكل زوج أسماء
UPDATE public.vehicles v
SET assigned_driver_id = cdc.keep_id::text
FROM canonical_driver_choice cdc
JOIN public.staff_members s_candidate
  ON s_candidate.role = 'driver'
 AND s_candidate.full_name IN (cdc.duplicate_name, cdc.keep_name)
WHERE s_candidate.id <> cdc.keep_id
  AND (
    v.assigned_driver_id = s_candidate.id::text
    OR v.assigned_driver_id = CAST(s_candidate.id AS TEXT)
    OR CAST(v.assigned_driver_id AS BIGINT) = s_candidate.id
  )
  AND v.assigned_driver_id IS NOT NULL;

-- التحقق من عدم وجود مركبات مرتبطة بأسماء محذوفة
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM public.vehicles v
  WHERE v.assigned_driver_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.staff_members s
      WHERE s.id::text = v.assigned_driver_id
         OR CAST(s.id AS TEXT) = v.assigned_driver_id
         OR s.id = CAST(v.assigned_driver_id AS BIGINT)
    );
  
  IF orphaned_count > 0 THEN
    RAISE WARNING 'تم العثور على % مركبة مرتبطة بسائقين غير موجودين. سيتم إزالة الربط.', orphaned_count;
    UPDATE public.vehicles
    SET assigned_driver_id = NULL
    WHERE assigned_driver_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.staff_members s
        WHERE s.id::text = vehicles.assigned_driver_id
           OR CAST(s.id AS TEXT) = vehicles.assigned_driver_id
           OR s.id = CAST(vehicles.assigned_driver_id AS BIGINT)
      );
  END IF;
END $$;

-- 3) تحديث المراجع في جدول exit_requests
-- تحويل أي سجل مكرر غير محفوظ إلى السجل الذي تم اختياره لكل زوج أسماء
UPDATE public.exit_requests er
SET driver_id = cdc.keep_id
FROM canonical_driver_choice cdc
JOIN public.staff_members s_candidate
  ON s_candidate.role = 'driver'
 AND s_candidate.full_name IN (cdc.duplicate_name, cdc.keep_name)
WHERE s_candidate.id <> cdc.keep_id
  AND er.driver_id = s_candidate.id
  AND er.driver_id IS NOT NULL;

-- 4) حذف الأسماء المتكررة من staff_members
-- حذف السجلات غير المحفوظة فقط بعد تحويل المراجع عنها
DELETE FROM public.staff_members sm
USING canonical_driver_choice cdc
WHERE sm.role = 'driver'
  AND sm.full_name IN (cdc.duplicate_name, cdc.keep_name)
  AND sm.id <> cdc.keep_id;

-- 5) تنظيف الجدول المؤقت
DROP TABLE IF EXISTS canonical_driver_choice;
DROP TABLE IF EXISTS driver_name_mapping;
