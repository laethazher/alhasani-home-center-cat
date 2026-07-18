/**
 * بيانات جدول المركبات 1 (من PDF) — اسم السائق ↔ رقم المركبة
 * تُستخدم لاستيراد السائقين والمركبات وتعيين الربط بينهما
 */
export interface DriverVehicleRow {
  driverName: string;
  vehicleNumber: number;
}

export const DRIVER_VEHICLE_PDF_ROWS: DriverVehicleRow[] = [
  { driverName: 'علي عبد الله جبل', vehicleNumber: 25472 }, // كان: على عبد الله جيل
  { driverName: 'بسام علي عكاب', vehicleNumber: 25097 }, // كان: بسام على عكاب
  { driverName: 'سيف الفقار راضي جبار', vehicleNumber: 22355 }, // كان: سيف الفقار راضي
  { driverName: 'احتياط', vehicleNumber: 32281 },
  { driverName: 'يوسف ابراهيم جدعان', vehicleNumber: 25173 },
  { driverName: 'احتياط', vehicleNumber: 37028 },
  { driverName: 'علي اكرم علي', vehicleNumber: 24087 }, // كان: على الكرم
  { driverName: 'رائد غانم حسب الله', vehicleNumber: 32280 }, // كان: رائد قائم
  { driverName: 'ثابت محمد منشد مشهد', vehicleNumber: 83337 }, // كان: ثابت محمد منشد
  { driverName: 'رضا حسين نجم', vehicleNumber: 77544 },
  { driverName: 'حسام عبد الرحيم عوده', vehicleNumber: 92048 }, // كان: حسام عبد الرحيم
  { driverName: 'ياسين سليم كريم', vehicleNumber: 65535 }, // كان: پاسین سلیم کریم
  { driverName: 'طه مثنى هيجل', vehicleNumber: 25691 },
  { driverName: 'مصطفى احمد حسين', vehicleNumber: 54716 },
  { driverName: 'مصطفى محمد سلمان سبتي', vehicleNumber: 93329 }, // كان: مصطفی محمد سلمان
  { driverName: 'عمار فارس كامل', vehicleNumber: 10965 }, // كان: عمار فارس کامل
  { driverName: 'نزار فالح خضير عبيد', vehicleNumber: 12923 }, // كان: نزار فالح خضير
  { driverName: 'ايوب احمد حامد حسين', vehicleNumber: 57024 }, // كان: ایوب احمد حامد
  { driverName: 'احتياط', vehicleNumber: 83968 },
  { driverName: 'علي محمد جواد عزيز', vehicleNumber: 51684 }, // كان: على محمد جواد
  { driverName: 'محمد عدنان عبد رشيد', vehicleNumber: 28445 }, // كان: محمد عدنان عبد
  { driverName: 'حيدر باسم محمد/كربلاء', vehicleNumber: 83113 }, // كان: جهاد باسم محمد.
  { driverName: 'احمد رفاعي عايد دعيبل', vehicleNumber: 10649 }, // كان: احمد رفاعی
  { driverName: 'بشار جاسم عكاب', vehicleNumber: 35551 }, // كان: بشار جاسم عکاب
  { driverName: 'احتياط', vehicleNumber: 33203 },
  { driverName: 'محمد صالح صاحب/نجف/سائق', vehicleNumber: 15556 }, // كان: محمد صالح صاحب
  { driverName: 'فراس حسن حمد/نجف/سائق', vehicleNumber: 75610 }, // كان: فراس حسن حمد
  { driverName: 'ليث عماد صباح/انبار', vehicleNumber: 22694 }, // كان: ليث عماد صباح
  { driverName: 'عمار احمد خاجي', vehicleNumber: 32279 }, // كان: عمار احمد
  { driverName: 'عباس خالد هادي/بابل/سائق', vehicleNumber: 21795 }, // كان: عباس خالد هادي
  { driverName: 'محمد ضياء الدين محمد/بابل', vehicleNumber: 22611 }, // كان: محمد ضياء الدين
  { driverName: 'حسين مالك هاشم/كوت', vehicleNumber: 89683 }, // كان: حسن مالك هاشم
  { driverName: 'بيشره وكريم محمد/اربيل', vehicleNumber: 22711 }, // كان: بیشره و كريم احمد
  { driverName: 'بسام شاكر مجيد/اربيل', vehicleNumber: 22561 }, // كان: بسام شاکر مجید
  { driverName: 'محمد ابراهيم احمد/اربيل', vehicleNumber: 25212 }, // كان: محمد ابراهيم احمد
  { driverName: 'علي حسين خلف', vehicleNumber: 10055 }, // كان: على حکمت عبيد (تم توحيده)
  { driverName: 'انير فواز سلمان', vehicleNumber: 10088 },
  { driverName: 'عمار فرج', vehicleNumber: 25103 },
  { driverName: 'حميد قيس', vehicleNumber: 24210 },
  { driverName: 'اثير باسم', vehicleNumber: 22700 },
  { driverName: 'امجد احمد حميد/بابل/سائق', vehicleNumber: 25551 }, // كان: امجد احمد
  { driverName: 'احتياط زیرو', vehicleNumber: 25108 },
  { driverName: 'احتياط', vehicleNumber: 24376 },
  { driverName: 'علي حسين خلف', vehicleNumber: 24433 }, // كان: على حسين خلف
];
