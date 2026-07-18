-- ================================================================
-- Migration: Inspect and Cleanup Drivers (with detailed logging)
-- ================================================================

DO $$
DECLARE
  driver RECORD;
  dup_count INTEGER := 0;
  unlinked_count INTEGER := 0;
  v_dup_id BIGINT;
  v_keep_id BIGINT;
  v_dup_linked BOOLEAN;
  v_keep_linked BOOLEAN;
  v_final_keep BIGINT;
  v_final_del BIGINT;
  pair RECORD;
  v_merged INTEGER := 0;
  v_unlinked_del INTEGER := 0;
BEGIN

  -- ──────────────────────────────────────────
  -- الخطوة 0: طباعة جميع السائقين الموجودين
  -- ──────────────────────────────────────────
  RAISE NOTICE '=== جميع السائقين الموجودين في قاعدة البيانات ===';
  FOR driver IN
    SELECT id, full_name, 
           EXISTS(
             SELECT 1 FROM public.vehicles v 
             WHERE v.assigned_driver_id = staff_members.id::text
                OR CAST(v.assigned_driver_id AS BIGINT) = staff_members.id
           ) AS is_linked
    FROM public.staff_members
    WHERE role = 'driver'
    ORDER BY full_name
  LOOP
    RAISE NOTICE 'ID: %, Name: "%", Linked: %', driver.id, driver.full_name, driver.is_linked;
  END LOOP;

  -- ──────────────────────────────────────────
  -- الخطوة 1: دمج الأزواج المتكررة المعروفة
  -- ──────────────────────────────────────────
  RAISE NOTICE '=== بدء دمج الأزواج المتكررة ===';
  
  FOR pair IN
    SELECT * FROM (VALUES
      ('على عبد الله جيل'::TEXT,    'علي عبد الله جبل'::TEXT),
      ('بسام على عكاب',              'بسام علي عكاب'),
      ('سيف الفقار راضي',            'سيف الفقار راضي جبار'),
      ('على الكرم',                  'علي اكرم علي'),
      ('رائد قائم',                  'رائد غانم حسب الله'),
      ('ثابت محمد منشد',             'ثابت محمد منشد مشهد'),
      ('حسام عبد الرحيم',            'حسام عبد الرحيم عوده'),
      ('پاسین سلیم کریم',            'ياسين سليم كريم'),
      ('مصطفی محمد سلمان',           'مصطفى محمد سلمان سبتي'),
      ('عمار فارس کامل',             'عمار فارس كامل'),
      ('نزار فالح خضير',             'نزار فالح خضير عبيد'),
      ('ایوب احمد حامد',             'ايوب احمد حامد حسين'),
      ('على محمد جواد',              'علي محمد جواد عزيز'),
      ('محمد عدنان عبد',             'محمد عدنان عبد رشيد'),
      ('احمد رفاعی',                 'احمد رفاعي عايد دعيبل'),
      ('بشار جاسم عکاب',             'بشار جاسم عكاب'),
      ('محمد صالح صاحب',             'محمد صالح صاحب/نجف/سائق'),
      ('فراس حسن حمد',               'فراس حسن حمد/نجف/سائق'),
      ('ليث عماد صباح',              'ليث عماد صباح/انبار'),
      ('عمار احمد',                  'عمار احمد خاجي'),
      ('عباس خالد هادي',             'عباس خالد هادي/بابل/سائق'),
      ('محمد ضياء الدين',            'محمد ضياء الدين محمد/بابل'),
      ('حسن مالك هاشم',              'حسين مالك هاشم/كوت'),
      ('بیشره و كريم احمد',           'بيشره وكريم محمد/اربيل'),
      ('بسام شاکر مجید',             'بسام شاكر مجيد/اربيل'),
      ('محمد ابراهيم احمد',           'محمد ابراهيم احمد/اربيل'),
      ('جهاد باسم محمد.',            'حيدر باسم محمد/كربلاء'),
      ('على حکمت عبيد',              'علي حسين خلف'),
      ('على حسين خلف',               'علي حسين خلف'),
      ('امجد احمد',                  'امجد احمد حميد/بابل/سائق')
    ) AS t(dup_name, keep_name)
  LOOP
    SELECT id INTO v_dup_id
    FROM public.staff_members
    WHERE full_name = pair.dup_name AND role = 'driver'
    LIMIT 1;

    SELECT id INTO v_keep_id
    FROM public.staff_members
    WHERE full_name = pair.keep_name AND role = 'driver'
    LIMIT 1;

    IF v_dup_id IS NOT NULL AND v_keep_id IS NOT NULL AND v_dup_id <> v_keep_id THEN
      RAISE NOTICE 'وجد زوج مكرر: "%" (ID: %) و "%" (ID: %)', pair.dup_name, v_dup_id, pair.keep_name, v_keep_id;
      
      SELECT EXISTS(
        SELECT 1 FROM public.vehicles WHERE assigned_driver_id = v_dup_id::text
           OR CAST(assigned_driver_id AS BIGINT) = v_dup_id
      ) INTO v_dup_linked;

      SELECT EXISTS(
        SELECT 1 FROM public.vehicles WHERE assigned_driver_id = v_keep_id::text
           OR CAST(assigned_driver_id AS BIGINT) = v_keep_id
      ) INTO v_keep_linked;

      RAISE NOTICE '  dup_linked: %, keep_linked: %', v_dup_linked, v_keep_linked;

      IF v_dup_linked AND NOT v_keep_linked THEN
        v_final_keep := v_dup_id;
        v_final_del  := v_keep_id;
        RAISE NOTICE '  → الاحتفاظ بـ "%" (ID: %) لأنه مرتبط', pair.dup_name, v_dup_id;
      ELSE
        v_final_keep := v_keep_id;
        v_final_del  := v_dup_id;
        RAISE NOTICE '  → الاحتفاظ بـ "%" (ID: %)', pair.keep_name, v_keep_id;
      END IF;

      UPDATE public.exit_requests
      SET driver_id = v_final_keep
      WHERE driver_id = v_final_del;

      UPDATE public.vehicles
      SET assigned_driver_id = v_final_keep::text
      WHERE assigned_driver_id = v_final_del::text
         OR CAST(assigned_driver_id AS BIGINT) = v_final_del;

      DELETE FROM public.staff_members WHERE id = v_final_del;

      v_merged := v_merged + 1;
      RAISE NOTICE '  ✓ تم دمج الزوج: حُذف ID=%', v_final_del;
    ELSIF v_dup_id IS NOT NULL AND v_keep_id IS NULL THEN
      RAISE NOTICE 'وجد الاسم المكرر "%" (ID: %) لكن الاسم الكامل "%" غير موجود', pair.dup_name, v_dup_id, pair.keep_name;
    ELSIF v_dup_id IS NULL AND v_keep_id IS NOT NULL THEN
      RAISE NOTICE 'وجد الاسم الكامل "%" (ID: %) لكن الاسم المكرر "%" غير موجود', pair.keep_name, v_keep_id, pair.dup_name;
    END IF;

    v_dup_id  := NULL;
    v_keep_id := NULL;
  END LOOP;

  -- ──────────────────────────────────────────
  -- الخطوة 2: حذف جميع السائقين غير المرتبطين بأي مركبة
  -- ──────────────────────────────────────────
  RAISE NOTICE '=== بدء حذف السائقين غير المرتبطين ===';

  UPDATE public.exit_requests
  SET driver_id = NULL
  WHERE driver_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.assigned_driver_id = exit_requests.driver_id::text
         OR CAST(v.assigned_driver_id AS BIGINT) = exit_requests.driver_id
    );

  DELETE FROM public.staff_members
  WHERE role = 'driver'
    AND NOT EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.assigned_driver_id = staff_members.id::text
         OR CAST(v.assigned_driver_id AS BIGINT) = staff_members.id
    );

  GET DIAGNOSTICS v_unlinked_del = ROW_COUNT;
  
  RAISE NOTICE '=== النتيجة النهائية ===';
  RAISE NOTICE 'تم دمج % زوج مكرر', v_merged;
  RAISE NOTICE 'تم حذف % سائق غير مرتبط', v_unlinked_del;
END $$;
