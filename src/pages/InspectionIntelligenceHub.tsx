import { useEffect, useMemo, useState } from 'react';
import { Brain, ChevronRight } from 'lucide-react';
import type { UserProfile } from '../lib/supabaseClient';
import type { DepartmentCode } from '../data/department';
import InspectionIntelligencePanel from '../components/inspection-intelligence/InspectionIntelligencePanel';
import ItemAggregateView from '../components/inspection-intelligence/ItemAggregateView';

export type IntelligenceHubTab = 'overview' | 'recovery' | 'item-search';
export type IntelligenceRecoverySubTab = 'worklist' | 'archive';

export interface IntelligenceHubLaunchParams {
  initialTab?: IntelligenceHubTab;
  initialRecoverySubTab?: IntelligenceRecoverySubTab;
}

interface InspectionIntelligenceHubProps {
  profile: UserProfile;
  department?: DepartmentCode;
  launchParams?: IntelligenceHubLaunchParams | null;
  onConsumeLaunchParams?: () => void;
  /** فتح تقرير مركبة أخير (من البحث الذكي KPI). */
  onOpenVehicleLatestReport?: (vehicleId: number) => void;
  /** التنقّل إلى صفحة التقارير لبدء فحص مركبة معيّنة. */
  onStartVehicleInspection: (vehicleId: string) => void;
  /** التنقّل إلى صفحة التقارير لعرض سجل مركبة معيّنة. */
  onOpenVehicleHistory: (vehicleId: string) => void;
}

export default function InspectionIntelligenceHub({
  profile,
  department = 'tajhiz',
  launchParams = null,
  onConsumeLaunchParams,
  onOpenVehicleLatestReport,
  onStartVehicleInspection,
  onOpenVehicleHistory,
}: InspectionIntelligenceHubProps) {
  const [activeTab, setActiveTab] = useState<IntelligenceHubTab>(
    launchParams?.initialTab ?? 'overview',
  );
  const [recoverySubTab, setRecoverySubTab] = useState<IntelligenceRecoverySubTab>(
    launchParams?.initialRecoverySubTab ?? 'worklist',
  );

  useEffect(() => {
    if (!launchParams) return;
    if (launchParams.initialTab) setActiveTab(launchParams.initialTab);
    if (launchParams.initialRecoverySubTab) setRecoverySubTab(launchParams.initialRecoverySubTab);
    onConsumeLaunchParams?.();
  }, [launchParams, onConsumeLaunchParams]);

  const canDeleteRecovery = profile.role === 'admin';
  const canRebuildRecovery = useMemo(
    () =>
      profile.role === 'admin' ||
      profile.role === 'manager' ||
      profile.role === 'maintenance_manager' ||
      profile.role === 'logistics' ||
      (department === 'installation' && profile.role === 'installation_department'),
    [profile.role, department],
  );

  // التبويبات الرئيسية في الصفحة الكاملة. "البحث الذكي" تبويب جديد للصفحة فقط
  // ولا يُمرّر إلى Panel (الذي يملك تبويباته الداخلية overview/recovery).
  const mainTabs: Array<{ id: IntelligenceHubTab; label: string }> = [
    { id: 'overview', label: 'لوحة الذكاء' },
    { id: 'recovery', label: 'نواقص الجرد' },
    { id: 'item-search', label: 'البحث الذكي للعناصر' },
  ];

  const panelInitialTab = activeTab === 'recovery' ? 'recovery' : 'overview';

  return (
    <div className="pb-12" dir="rtl">
      {/* Breadcrumb + عنوان */}
      <div className="flex flex-col gap-3 mb-4">
        <nav
          aria-label="breadcrumb"
          className="flex items-center gap-1.5 text-[11px] font-bold text-stone-500 dark:text-stone-400"
        >
          <span>لوحة التحكم</span>
          <ChevronRight className="w-3 h-3 opacity-60 rotate-180" />
          <span className="text-stone-900 dark:text-stone-100">مركز الذكاء</span>
        </nav>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg">
              <Brain className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-black text-stone-900 dark:text-stone-50 truncate">
                Inspection Intelligence
              </h1>
              <p className="text-[11px] md:text-xs font-bold text-stone-500 dark:text-stone-400 truncate">
                مركز تحليل الجرد الذكي · عرض شامل لحالة الأسطول والنواقص
              </p>
            </div>
          </div>
          <div
            className={
              department === 'installation'
                ? 'rounded-xl px-3 py-1.5 text-[11px] font-black border bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                : 'rounded-xl px-3 py-1.5 text-[11px] font-black border bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-200'
            }
          >
            {department === 'installation' ? 'قسم التركيب' : 'قسم التجهيز'}
          </div>
        </div>
      </div>

      {/* شريط تبويبات الصفحة الكاملة */}
      <div className="mb-4 flex items-center gap-1 p-1 rounded-2xl bg-stone-100/70 dark:bg-stone-800/70 border border-stone-200/80 dark:border-stone-700/80 overflow-x-auto">
        {mainTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={
              'flex-1 min-w-[140px] px-4 py-2 rounded-xl text-xs font-black transition-colors ' +
              (activeTab === t.id
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-50 shadow-sm'
                : 'text-stone-600 dark:text-stone-300 hover:bg-white/60 dark:hover:bg-stone-900/50')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* المحتوى */}
      {activeTab === 'item-search' ? (
        <ItemAggregateView
          department={department}
          onOpenVehicleLatestReport={onOpenVehicleLatestReport}
        />
      ) : (
        <InspectionIntelligencePanel
          pageDepartment={department}
          canDeleteRecovery={canDeleteRecovery}
          canRebuildRecovery={canRebuildRecovery}
          initialTab={panelInitialTab}
          initialRecoverySubTab={recoverySubTab}
          onStartInspection={(vehicleId) => onStartVehicleInspection(String(vehicleId))}
          onOpenHistory={(vehicleId) => onOpenVehicleHistory(String(vehicleId))}
        />
      )}
    </div>
  );
}
