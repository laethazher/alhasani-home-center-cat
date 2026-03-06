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
  ('على حسين خلف', 'علي حسين خلف'),
  ('امجد احمد', 'امجد احمد حميد/بابل/سائق');
  -- ملاحظة: تم إزالة 'على حکمت عبيد' و 'جهاد باسم محمد.' لأن التطابق غير مؤكد

-- 2) تحديث المراجع في جدول vehicles
-- التأكد من تحديث جميع المركبات المرتبطة بالأسماء المكررة
UPDATE public.vehicles v
SET assigned_driver_id = (
  SELECT s.id::text 
  FROM public.staff_members s
  JOIN driver_name_mapping dnm ON s.full_name = dnm.keep_name
  WHERE s.role = 'driver'
  ORDER BY s.id
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 
  FROM public.staff_members s
  JOIN driver_name_mapping dnm ON s.full_name = dnm.duplicate_name
  WHERE s.role = 'driver'
    AND (
      v.assigned_driver_id = s.id::text 
      OR v.assigned_driver_id = CAST(s.id AS TEXT)
      OR CAST(v.assigned_driver_id AS BIGINT) = s.id
    )
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
UPDATE public.exit_requests er
SET driver_id = (
  SELECT s.id 
  FROM public.staff_members s
  JOIN driver_name_mapping dnm ON s.full_name = dnm.keep_name
  WHERE s.role = 'driver'
  ORDER BY s.id
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 
  FROM public.staff_members s
  JOIN driver_name_mapping dnm ON s.full_name = dnm.duplicate_name
  WHERE s.role = 'driver'
    AND er.driver_id = s.id
)
AND er.driver_id IS NOT NULL;

-- 4) حذف الأسماء المتكررة من staff_members
-- فقط إذا كان الاسم المحفوظ موجود فعلاً
DELETE FROM public.staff_members sm
WHERE sm.role = 'driver'
  AND sm.full_name IN (SELECT duplicate_name FROM driver_name_mapping)
  AND EXISTS (
    SELECT 1 
    FROM public.staff_members s
    JOIN driver_name_mapping dnm ON s.full_name = dnm.keep_name
    WHERE s.role = 'driver'
      AND s.full_name = (SELECT keep_name FROM driver_name_mapping WHERE duplicate_name = sm.full_name LIMIT 1)
  );

-- 5) تنظيف الجدول المؤقت
DROP TABLE IF EXISTS driver_name_mapping;
