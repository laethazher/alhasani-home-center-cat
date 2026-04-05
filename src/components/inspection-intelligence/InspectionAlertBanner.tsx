import { AlertTriangle, Brain } from 'lucide-react';
import type { DepartmentCode } from '../../data/department';
import { useInspectionCriticalCount } from '../../hooks/useInspectionCriticalCount';

interface InspectionAlertBannerProps {
  department: DepartmentCode;
  /** عند إيقاف الجلب (مثلاً واجهة مبسّطة) */
  enabled?: boolean;
  onGoToReports?: () => void;
}

export default function InspectionAlertBanner({
  department,
  enabled = true,
  onGoToReports,
}: InspectionAlertBannerProps) {
  const { loading, criticalCount } = useInspectionCriticalCount(department, enabled);

  if (!enabled || loading || criticalCount === null || criticalCount < 1) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-300/80 dark:border-rose-800 bg-rose-50/95 dark:bg-rose-950/35 px-4 py-3"
      role="status"
    >
      <span className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-full bg-rose-600 text-white text-sm font-black">
        {criticalCount}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-rose-900 dark:text-rose-100 flex items-center gap-2">
          <Brain className="w-4 h-4 shrink-0 opacity-80" />
          ذكاء الجرد: مركبات متأخرة عن دورة الفحص
        </p>
        <p className="text-sm text-rose-800/95 dark:text-rose-200/85 mt-0.5">
          يوجد {criticalCount} مركبة بحالة حرجة وفق دورة الجرد — يُنصح بمراجعة التقارير وإكمال الفحص.
        </p>
      </div>
      {onGoToReports ? (
        <button
          type="button"
          onClick={onGoToReports}
          className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors"
        >
          فتح التقارير
        </button>
      ) : null}
      <AlertTriangle className="w-7 h-7 text-rose-500 dark:text-rose-400 shrink-0 hidden sm:block" />
    </div>
  );
}
