import type { DepartmentCode } from '../data/department';

/**
 * ناقل أحداث بسيط داخل الصفحة لإبلاغ كل المستمعين بأن قوالب الجرد
 * قد تغيّرت (إضافة عنصر جديد، تحديث اسم/باركود، تعطيل قالب…).
 * يُستخدم لتنسيق إعادة الجلب في Reports و ReportsHub و InspectionIntelligenceHub
 * و VehicleLatestReport و ItemAggregateView دون الحاجة إلى state manager.
 *
 * يكمِّل هذا الناقل اشتراك Realtime في الجداول (التقارير، النواقص، إلخ): إعلاناً
 * بعد حفظ القالب من هذه الواجهة، والاشتراك لالتقاط أي تعديل خارج التطبيق أو من تبويب آخر.
 *
 * يعتمد على EventTarget المدمج (بدون تبعيات إضافية).
 */
type TemplatesChangedDetail = {
  department: DepartmentCode;
  changeType: 'created' | 'updated' | 'deleted' | 'reordered' | 'bulk';
};

class InventoryTemplatesBus extends EventTarget {
  private static EVENT = 'inventory-templates:changed';

  /** إطلاق حدث تحديث. يجب استدعاؤه بعد أي upsert/insert/delete على قوالب الجرد. */
  notifyChanged(detail: TemplatesChangedDetail): void {
    this.dispatchEvent(new CustomEvent(InventoryTemplatesBus.EVENT, { detail }));
  }

  /** الاشتراك في أحداث التحديث. يُعيد دالة لإلغاء الاشتراك. */
  subscribe(
    department: DepartmentCode,
    handler: (detail: TemplatesChangedDetail) => void,
  ): () => void {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<TemplatesChangedDetail>).detail;
      if (!detail) return;
      if (detail.department !== department) return;
      handler(detail);
    };
    this.addEventListener(InventoryTemplatesBus.EVENT, listener);
    return () => this.removeEventListener(InventoryTemplatesBus.EVENT, listener);
  }
}

export const inventoryTemplatesBus = new InventoryTemplatesBus();
export type { TemplatesChangedDetail };
