export interface InspectionItem {
  id: number;
  label: string;
}

export const WEEKLY_INSPECTION_ITEMS: InspectionItem[] = [
  { id: 1, label: "الماسحات وأذرعتها" },
  { id: 2, label: "المرايا الجانبيه" },
  { id: 3, label: "مرأة السائق" },
  { id: 4, label: "فرش الدواسات" },
  { id: 5, label: "واقيات الشمس" },
  { id: 6, label: "مقاعد المركبة" },
  { id: 7, label: "المصابيح الخارجيه" },
  { id: 8, label: "البطاريات" },
  { id: 9, label: "الراديو والمسجل" },
  { id: 10, label: "عدة المركبة" },
  { id: 11, label: "مفتاح العجلات" },
  { id: 12, label: "طفاية" },
  { id: 13, label: "رافعه" },
  { id: 14, label: "أطار احتياطي" },
  { id: 15, label: "سلك توصيل (جطل)" },
  { id: 16, label: "مثلث مروري" },
  { id: 17, label: "الزجاج الامامي" },
];

export interface ToolItem {
  id: number;
  name: string;
  quantity: number;
}

export interface ToolImage {
  toolId: number;
  images: string[];
}

export const TOOL_INVENTORY_ITEMS: ToolItem[] = [
  { id: 1, name: "نرمادة عدله هايدروليك", quantity: 4 },
  { id: 2, name: "نرمادة عدلة عادية", quantity: 4 },
  { id: 3, name: "نرمادة نصف عكفة عادية", quantity: 4 },
  { id: 4, name: "نرمادة نصف عكفة هايدروليك", quantity: 4 },
  { id: 5, name: "زوايا سرير كبيرة", quantity: 5 },
  { id: 6, name: "زوايا 6 فتحات صغيرة", quantity: 5 },
  { id: 7, name: "سكة هايدروليك قياس 30", quantity: 2 },
  { id: 8, name: "سكة هايدروليك قياس 40", quantity: 2 },
  { id: 9, name: "سكة هايدروليك قياس 35", quantity: 2 },
  { id: 10, name: "بطارية", quantity: 1 },
  { id: 11, name: "براغي كوشة", quantity: 100 },
  { id: 12, name: "براغي سلايد", quantity: 100 },
  { id: 13, name: "برغي دبدوب", quantity: 50 },
  { id: 14, name: "قفل + لبلوب", quantity: 50 },
  { id: 15, name: "معالجات جميع الالوان", quantity: 1 },
  { id: 16, name: "تيب مسلح", quantity: 1 },
  { id: 17, name: "حمالة رف", quantity: 25 },
  { id: 18, name: "كتر موس", quantity: 2 },
  { id: 19, name: "فيتة", quantity: 1 },
  { id: 20, name: "طلقات دريل", quantity: 3 },
  { id: 21, name: "مساطر خشب", quantity: 10 },
  { id: 22, name: "حساس انارة", quantity: 5 },
  { id: 23, name: "شاحنة انارة", quantity: 5 },
  { id: 24, name: "شريط انارة بكرة", quantity: 1 },
  { id: 25, name: "كاوية + صولدر", quantity: 1 },
  { id: 26, name: "حمالة بوري تعالكة", quantity: 10 },
  { id: 27, name: "بوري تعالكة", quantity: 2 },
  { id: 28, name: "ادبتر لبة", quantity: 3 },
  { id: 29, name: "دريل", quantity: 3 },
];
