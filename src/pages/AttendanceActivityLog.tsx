import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Archive,
  Download,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getDepartmentClient } from '../data/supabaseSource';
import type { DepartmentCode } from '../data/department';
import type { UserProfile, AttendanceActivityLog } from '../lib/supabaseClient';

const ACTION_LABELS: Record<string, { label: string; icon: typeof Plus }> = {
  add: { label: 'إضافة', icon: Plus },
  edit: { label: 'تعديل', icon: Edit },
  archive: { label: 'أرشفة', icon: Archive },
  export: { label: 'تصدير', icon: Download },
};

const PAGE_SIZE = 25;

interface Props {
  profile: UserProfile | null;
  department?: DepartmentCode;
}

export default function AttendanceActivityLog({ profile, department = 'tajhiz' }: Props) {
  const supabase = getDepartmentClient(department);
  const activityTable = department === 'installation' ? 'installation_attendance_activity_log' : 'attendance_activity_log';
  const [logs, setLogs] = useState<(AttendanceActivityLog & { user_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filterAction, setFilterAction] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from(activityTable)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filterAction !== 'all') query = query.eq('action_type', filterAction);

    const { data: logData, count } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (logData && logData.length > 0) {
      const userIds = [...new Set(logData.map((l) => l.user_id).filter(Boolean))] as string[];
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', userIds);
      const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      setLogs(
        logData.map((l) => ({
          ...l,
          user_name: l.user_id ? nameMap.get(l.user_id) ?? '—' : '—',
        }))
      );
    } else {
      setLogs([]);
    }
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [page, filterAction, supabase, activityTable]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl p-4 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-stone-500" />
          <h3 className="font-semibold">سجل النشاط</h3>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm text-stone-500 mb-1">نوع الإجراء</label>
            <select
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); setPage(0); }}
              className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm"
            >
              <option value="all">الكل</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl shadow-sm overflow-hidden"
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="bg-stone-100 dark:bg-stone-700/50">
                    <th className="px-4 py-3 text-right text-sm font-semibold">التاريخ والوقت</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">الإجراء</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">المستخدم</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">التفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l, idx) => {
                    const conf = ACTION_LABELS[l.action_type] ?? { label: l.action_type, icon: Activity };
                    const Icon = conf.icon;
                    const meta = l.metadata as Record<string, unknown>;
                    const details = [
                      meta.date && `التاريخ: ${meta.date}`,
                      meta.count != null && `العدد: ${meta.count}`,
                      meta.archived_count != null && `أُرشف: ${meta.archived_count}`,
                      meta.dateFrom && meta.dateTo && `من ${meta.dateFrom} إلى ${meta.dateTo}`,
                      meta.type === 'report' && 'تقرير',
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <tr
                        key={l.id}
                        className={cn(
                          'border-t border-stone-100 dark:border-stone-700/50',
                          idx % 2 === 0 && 'bg-stone-50/50 dark:bg-stone-800/30'
                        )}
                      >
                        <td className="px-4 py-2 text-sm">
                          {new Date(l.created_at).toLocaleString('ar-IQ', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-sm">
                            <Icon className="w-4 h-4" />
                            {conf.label}
                          </span>
                        </td>
                        <td className="px-4 py-2">{l.user_name ?? '—'}</td>
                        <td className="px-4 py-2 text-stone-600 dark:text-stone-400 text-sm max-w-[280px] truncate">
                          {details || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {logs.length === 0 && (
              <div className="py-16 text-center text-stone-500 dark:text-stone-400">
                لا توجد سجلات نشاط
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-stone-200 dark:border-stone-700">
                <p className="text-sm text-stone-500">
                  صفحة {page + 1} من {totalPages} ({totalCount} سجل)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-2 rounded-lg bg-stone-100 dark:bg-stone-700 disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-2 rounded-lg bg-stone-100 dark:bg-stone-700 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
