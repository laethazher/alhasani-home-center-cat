-- ================================================================
-- Migration: Final Driver Cleanup
-- حذف الأسماء المتكررة + غير المرتبطة بمركبات
-- ================================================================

DO $$
DECLARE
  pair RECORD;
  v_dup_id BIGINT;
  v_keep_id BIGINT;
  v_dup_linked BOOLEAN;
  v_keep_linked BOOLEAN;
  v_final_keep BIGINT;
  v_final_del BIGINT;
  v_merged INTEGER := 0;
  v_unlinked_del INTEGER := 0;
BEGIN

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
      SELECT EXISTS(
        SELECT 1 FROM public.vehicles WHERE assigned_driver_id = v_dup_id::text
      ) INTO v_dup_linked;

      SELECT EXISTS(
        SELECT 1 FROM public.vehicles WHERE assigned_driver_id = v_keep_id::text
      ) INTO v_keep_linked;

      IF v_dup_linked AND NOT v_keep_linked THEN
        v_final_keep := v_dup_id;
        v_final_del  := v_keep_id;
      ELSE
        v_final_keep := v_keep_id;
        v_final_del  := v_dup_id;
      END IF;

      UPDATE public.exit_requests
      SET driver_id = v_final_keep
      WHERE driver_id = v_final_del;

      UPDATE public.vehicles
      SET assigned_driver_id = v_final_keep::text
      WHERE assigned_driver_id = v_final_del::text;

      DELETE FROM public.staff_members WHERE id = v_final_del;
      v_merged := v_merged + 1;
    END IF;

    v_dup_id  := NULL;
    v_keep_id := NULL;
  END LOOP;

  UPDATE public.exit_requests
  SET driver_id = NULL
  WHERE driver_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.assigned_driver_id = exit_requests.driver_id::text
    );

  DELETE FROM public.staff_members
  WHERE role = 'driver'
    AND NOT EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.assigned_driver_id = staff_members.id::text
    );

  GET DIAGNOSTICS v_unlinked_del = ROW_COUNT;
  RAISE NOTICE 'Merged: % pairs, Deleted unlinked: %', v_merged, v_unlinked_del;
END $$;
