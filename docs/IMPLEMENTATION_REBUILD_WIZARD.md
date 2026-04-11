# تنفيذ يدوي: معالج إعادة الاحتساب + التاريخ + الرمز 0000

إذا كان وضع الخطة يمنع التعديل التلقائي، انسخ الأكواد أدناه أو فعّل **Agent mode** واطلب التطبيق.

## 1) تعديل `src/lib/inspectionRecovery/calculateInspectionRecovery.ts`

- أضف إلى `RebuildInspectionRecoveryOptions` الحقل:  
  `createdAtBetween?: { startIso: string; endIso: string } | null;`
- أضف الدالة المُصدَّرة:

```ts
export function dateInputsToCreatedAtRange(fromYmd: string, toYmd: string): { startIso: string; endIso: string } {
  const start = new Date(`${fromYmd.trim()}T00:00:00.000`);
  const end = new Date(`${toYmd.trim()}T23:59:59.999`);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}
```

- في `rebuildInspectionRecoveryForAllReports`: استخرج `createdAtBetween` من `options`.
- استبدل استعلام العدّ والدفعات كما في النسخة الكاملة في الفرع/Agent (فلتر `gte/lte` على `created_at`).

## 2) تعديل `src/components/inspection-intelligence/InspectionIntelligenceDrawer.tsx`

- استيراد:  
  `dateInputsToCreatedAtRange` من `calculateInspectionRecovery` (مع `rebuildInspectionRecoveryForAllReports`).
- ثابت: `const REBUILD_GUARD_PIN = '0000';`
- حالة: `rebuildWizardOpen`, `rebuildWizardStep` (`dates` | `pin` | `confirm`), `rebuildDateFrom`, `rebuildDateTo`, `rebuildFullLog`, `rebuildPin`.
- الزر «إعادة احتساب السجل من التقارير» يفتح المودال بدل استدعاء التنفيذ المباشر.
- التدفق: تواريخ + (اختياري) كامل السجل → زر «احتساب» → إدخال الرمز → خطوة تأكيد نهائية → استدعاء `rebuildInspectionRecoveryForAllReports({ ..., createdAtBetween: rebuildFullLog ? null : dateInputsToCreatedAtRange(...) })`.

(الكود التفصيلي يُطبَّق عبر Agent عند توفر الصلاحية.)

---

## إجراء فوري

1. في Cursor: **Chat → Agent** (أو قبول التبديل إلى وضع التنفيذ).
2. أرسل: «طبّق معالج إعادة الاحتساب مع التاريخ والرمز 0000 كما في المحادثة».

بدون ذلك، انسخ يدوياً من الأقسام التالية (أو استخدم `git apply` إذا وفّرت ملف patch).

---

## ملف كامل مقترح: `calculateInspectionRecovery.ts`

يُستبدل محتوى الملف الحالي بالكامل بالنسخة التي تحتوي `createdAtBetween` و`dateInputsToCreatedAtRange` وفلترة العدّ والدفعات (نفس المنطق في آخر تنفيذ مخطط له في المحادثة).

---

## مقتطفات الواجهة (`InspectionIntelligenceDrawer.tsx`)

### استيراد

```ts
import {
  rebuildInspectionRecoveryForAllReports,
  dateInputsToCreatedAtRange,
} from '../../lib/inspectionRecovery/calculateInspectionRecovery';

const REBUILD_GUARD_PIN = '0000';

function defaultRebuildDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}
```

### حالة

```ts
const [rebuildWizardOpen, setRebuildWizardOpen] = useState(false);
const [rebuildWizardStep, setRebuildWizardStep] = useState<'dates' | 'pin' | 'confirm'>('dates');
const [rebuildDateFrom, setRebuildDateFrom] = useState('');
const [rebuildDateTo, setRebuildDateTo] = useState('');
const [rebuildFullLog, setRebuildFullLog] = useState(false);
const [rebuildPin, setRebuildPin] = useState('');
```

### فتح المعالج (بدل التنفيذ المباشر من الزر)

```ts
const openRebuildWizard = useCallback(() => {
  const d = defaultRebuildDateRange();
  setRebuildDateFrom(d.from);
  setRebuildDateTo(d.to);
  setRebuildFullLog(false);
  setRebuildPin('');
  setRebuildWizardStep('dates');
  setRebuildWizardOpen(true);
}, []);
```

### التنفيذ الفعلي (بعد التأكيد النهائي)

```ts
const executeRebuildAllRecovery = useCallback(
  async (createdAtBetween: { startIso: string; endIso: string } | null) => {
    if (!canRebuildRecovery || rebuildingAllRecovery) return;
    setRebuildingAllRecovery(true);
    setRebuildAllProgress({ processed: 0, total: 0 });
    setRecoveryActionNotice(null);
    try {
      const summary = await rebuildInspectionRecoveryForAllReports({
        client,
        department,
        batchSize: 500,
        createdAtBetween,
        onProgress: (processed, total) => setRebuildAllProgress({ processed, total }),
      });
      const errPart =
        summary.errors.length > 0
          ? ` — تنبيه: تعذر معالجة ${summary.errors.length} تقرير.`
          : '';
      setRecoveryActionNotice(
        `تمت إعادة الاحتساب: عُالج ${summary.processed} تقرير، صفوف مدرجة ${summary.insertedRows}، تخطي بدون عدة ${summary.skippedNoToolkit}.${errPart}`,
      );
      await loadRecoveryRows();
      await loadRecoveryActions();
      await loadDeficits();
    } catch (e) {
      console.error('executeRebuildAllRecovery', e);
      setRecoveryActionNotice('تعذر إعادة احتساب السجل.');
    } finally {
      setRebuildingAllRecovery(false);
      setRebuildAllProgress(null);
      setRebuildWizardOpen(false);
    }
  },
  [canRebuildRecovery, rebuildingAllRecovery, client, department, loadDeficits, loadRecoveryActions, loadRecoveryRows],
);
```

### منطق الخطوات

- **احتساب:** إن لم يُحدَّد «كامل السجل» فتأكد من `rebuildDateFrom` و`rebuildDateTo` و`from <= to` ثم `setRebuildWizardStep('pin')`.
- **رمز:** إذا `rebuildPin !== REBUILD_GUARD_PIN` → تنبيه؛ وإلا `setRebuildWizardStep('confirm')`.
- **تأكيد نهائي:** زر ينفّذ  
  `void executeRebuildAllRecovery(rebuildFullLog ? null : dateInputsToCreatedAtRange(rebuildDateFrom, rebuildDateTo))`.

### واجهة (مثال هيكل)

طبقة ثابتة `z-[200]` فوق الدرج، `motion.div` للمحتوى، حقول `type="date"`، `checkbox` لـ «إعادة احتساب كامل السجل»، `input` لكلمة المرور `type="password"` في خطوة `pin`، ونص تأكيد في خطوة `confirm`.

### إزالة

احذف الاستدعاء القديم `runRebuildAllRecovery` مع `window.confirm` المباشر أو استبدله بالمنطق أعلاه.
