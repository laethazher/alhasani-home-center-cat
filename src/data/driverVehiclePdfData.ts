/**
 * بيانات جدول المركبات 1 (من PDF) — اسم السائق ↔ رقم المركبة
 * تُستخدم لاستيراد السائقين والمركبات وتعيين الربط بينهما
 */
export interface DriverVehicleRow {
  driverName: string;
  vehicleNumber: number;
}

export const DRIVER_VEHICLE_PDF_ROWS: DriverVehicleRow[] = [
  { driverName: 'على عبد الله جيل', vehicleNumber: 25472 },
  { driverName: 'بسام على عكاب', vehicleNumber: 25097 },
  { driverName: 'سيف الفقار راضي', vehicleNumber: 22355 },
  { driverName: 'احتياط', vehicleNumber: 32281 },
  { driverName: 'يوسف ابراهيم جدعان', vehicleNumber: 25173 },
  { driverName: 'احتياط', vehicleNumber: 37028 },
  { driverName: 'على الكرم', vehicleNumber: 24087 },
  { driverName: 'رائد قائم', vehicleNumber: 32280 },
  { driverName: 'ثابت محمد منشد', vehicleNumber: 83337 },
  { driverName: 'رضا حسين نجم', vehicleNumber: 77544 },
  { driverName: 'حسام عبد الرحيم', vehicleNumber: 92048 },
  { driverName: 'پاسین سلیم کریم', vehicleNumber: 65535 },
  { driverName: 'طه مثنى هيجل', vehicleNumber: 25691 },
  { driverName: 'مصطفى احمد حسين', vehicleNumber: 54716 },
  { driverName: 'مصطفی محمد سلمان', vehicleNumber: 93329 },
  { driverName: 'عمار فارس کامل', vehicleNumber: 10965 },
  { driverName: 'نزار فالح خضير', vehicleNumber: 12923 },
  { driverName: 'ایوب احمد حامد', vehicleNumber: 57024 },
  { driverName: 'احتياط', vehicleNumber: 83968 },
  { driverName: 'على محمد جواد', vehicleNumber: 51684 },
  { driverName: 'محمد عدنان عبد', vehicleNumber: 28445 },
  { driverName: 'جهاد باسم محمد.', vehicleNumber: 83113 },
  { driverName: 'احمد رفاعی', vehicleNumber: 10649 },
  { driverName: 'بشار جاسم عکاب', vehicleNumber: 35551 },
  { driverName: 'احتياط', vehicleNumber: 33203 },
  { driverName: 'محمد صالح صاحب', vehicleNumber: 15556 },
  { driverName: 'فراس حسن حمد', vehicleNumber: 75610 },
  { driverName: 'ليث عماد صباح', vehicleNumber: 22694 },
  { driverName: 'عمار احمد', vehicleNumber: 32279 },
  { driverName: 'عباس خالد هادي', vehicleNumber: 21795 },
  { driverName: 'محمد ضياء الدين', vehicleNumber: 22611 },
  { driverName: 'حسن مالك هاشم', vehicleNumber: 89683 },
  { driverName: 'بیشره و كريم احمد', vehicleNumber: 22711 },
  { driverName: 'بسام شاکر مجید', vehicleNumber: 22561 },
  { driverName: 'محمد ابراهيم احمد', vehicleNumber: 25212 },
  { driverName: 'على حکمت عبيد', vehicleNumber: 10055 },
  { driverName: 'انير فواز سلمان', vehicleNumber: 10088 },
  { driverName: 'عمار فرج', vehicleNumber: 25103 },
  { driverName: 'حميد قيس', vehicleNumber: 24210 },
  { driverName: 'اثير باسم', vehicleNumber: 22700 },
  { driverName: 'امجد احمد', vehicleNumber: 25551 },
  { driverName: 'احتياط زیرو', vehicleNumber: 25108 },
  { driverName: 'احتياط', vehicleNumber: 24433 },
  { driverName: 'على حسين خلف', vehicleNumber: 24376 },
];
