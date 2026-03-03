import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Search,
  Clock,
  Timer,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  TrendingUp,
  Shield,
  Loader2,
  FileText,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import type { ExitRequest, StaffMember } from '../lib/supabaseClient';

/* ── Types ── */
interface ViolationRecord {
  requestId: string;
  exitDate: string;
  exitReason: string | null;
  allowedMinutes: number;
  delayMinutes: number;
  delayText: string;
  returned: boolean;
  returnedAt: string | null;
}

interface StaffViolations {
  staffId: string;
  staffName: string;
  staffRole: 'driver' | 'assistant';
  totalViolations: number;
  totalDelayMinutes: number;
  records: ViolationRecord[];
}

/* ── Helpers ── */
function formatDelay(minutes: number): string {
  if (minutes <= 0) return 'أقل من دقيقة';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours} ساعة${mins > 0 ? ` و ${mins} دقيقة` : ''}`;
  return `${mins} دقيقة`;
}

function getSeverity(count: number): { label: string; color: string; bgColor: string } {
  if (count >= 5) return { label: 'خطير', color: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-100 dark:bg-red-900/30' };
  if (count >= 3) return { label: 'متوسط', color: 'text-orange-700 dark:text-orange-300', bgColor: 'bg-orange-100 dark:bg-orange-900/30' };
  return { label: 'منخفض', color: 'text-yellow-700 dark:text-yellow-300', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' };
}

/* ── Component ── */
export default function Violations() {
  const [requests, setRequests] = useState<ExitRequest[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'violations' | 'delay'>('violations');

  const fetchData = useCallback(async () => {
    const [reqRes, staffRes] = await Promise.all([
      supabase.from('exit_requests').select('*').eq('exit_type', 'temporary').in('status', ['exited']).order('created_at', { ascending: false }),
      supabase.from('staff_members').select('*').order('full_name'),
    ]);
    if (reqRes.data) setRequests(reqRes.data);
    if (staffRes.data) setStaff(staffRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Compute violations ── */
  const violationsMap = useMemo((): Map<string, StaffViolations> => {
    const map = new Map<string, StaffViolations>();
    const staffMap = new Map<string, StaffMember>(staff.map((s) => [s.id, s]));
    const now = new Date();

    for (const req of requests) {
      if (!req.exited_at || !req.exit_duration_minutes) continue;
      const exitedTime = new Date(req.exited_at).getTime();
      const allowedMs = req.exit_duration_minutes * 60 * 1000;
      const deadline = exitedTime + allowedMs;

      // Check each assistant
      for (let i = 0; i < req.assistant_ids.length; i++) {
        const aId = String(req.assistant_ids[i]);
        const aName = req.assistant_names[i] || 'مساعد';
        const returns = req.assistant_returns || {};
        const returnedAt = returns[aId];

        let delayMs = 0;
        let isViolation = false;

        if (returnedAt) {
          // Returned — check if late
          const returnTime = new Date(returnedAt).getTime();
          delayMs = returnTime - deadline;
          isViolation = delayMs > 0;
        } else {
          // Not returned yet — check if overdue
          delayMs = now.getTime() - deadline;
          isViolation = delayMs > 0;
        }

        if (isViolation) {
          const delayMinutes = Math.floor(delayMs / (1000 * 60));
          if (!map.has(aId)) {
            map.set(aId, {
              staffId: aId,
              staffName: staffMap.get(aId)?.full_name || aName,
              staffRole: 'assistant',
              totalViolations: 0,
              totalDelayMinutes: 0,
              records: [],
            });
          }
          const entry = map.get(aId)!;
          entry.totalViolations++;
          entry.totalDelayMinutes += delayMinutes;
          entry.records.push({
            requestId: req.id,
            exitDate: req.exited_at!,
            exitReason: req.exit_reason,
            allowedMinutes: req.exit_duration_minutes,
            delayMinutes,
            delayText: formatDelay(delayMinutes),
            returned: !!returnedAt,
            returnedAt: returnedAt || null,
          });
        }
      }

      // Check driver too (if present)
      if (req.driver_id) {
        const dId = req.driver_id;
        const dName = req.driver_name || 'سائق';
        // Driver is considered late if any assistant is still out and overdue,
        // or if the whole exit is overdue (no returns tracking for driver specifically)
        // We track driver violations based on the exit deadline vs now (if no assistants returned)
        const returns = req.assistant_returns || {};
        const allReturned = req.assistant_ids.length === 0 || req.assistant_ids.every((id) => String(id) in returns);
        
        if (!allReturned) {
          const delayMs = now.getTime() - deadline;
          if (delayMs > 0) {
            const delayMinutes = Math.floor(delayMs / (1000 * 60));
            if (!map.has(dId)) {
              map.set(dId, {
                staffId: dId,
                staffName: staffMap.get(dId)?.full_name || dName,
                staffRole: 'driver',
                totalViolations: 0,
                totalDelayMinutes: 0,
                records: [],
              });
            }
            const entry = map.get(dId)!;
            entry.totalViolations++;
            entry.totalDelayMinutes += delayMinutes;
            entry.records.push({
              requestId: req.id,
              exitDate: req.exited_at!,
              exitReason: req.exit_reason,
              allowedMinutes: req.exit_duration_minutes,
              delayMinutes,
              delayText: formatDelay(delayMinutes),
              returned: allReturned,
              returnedAt: null,
            });
          }
        }
      }
    }

    return map;
  }, [requests, staff]);

  /* ── Sorted + filtered list ── */
  const violationsList = useMemo((): StaffViolations[] => {
    let list: StaffViolations[] = Array.from(violationsMap.values());
    
    // Search filter
    if (search) {
      const term = search.toLowerCase();
      list = list.filter((v) => v.staffName.toLowerCase().includes(term));
    }

    // Sort
    if (sortBy === 'violations') {
      list.sort((a, b) => b.totalViolations - a.totalViolations);
    } else {
      list.sort((a, b) => b.totalDelayMinutes - a.totalDelayMinutes);
    }

    return list;
  }, [violationsMap, search, sortBy]);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const list: StaffViolations[] = Array.from(violationsMap.values());
    return {
      totalStaff: list.length,
      totalViolations: list.reduce((sum, v) => sum + v.totalViolations, 0),
      totalDelayMinutes: list.reduce((sum, v) => sum + v.totalDelayMinutes, 0),
      critical: list.filter((v) => v.totalViolations >= 5).length,
    };
  }, [violationsMap]);

  const toggleExpand = (id: string) => {
    setExpandedStaff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-3">
            <Shield className="w-7 h-7 text-red-600 dark:text-red-400" />
            سجل المخالفات
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">تتبع تأخيرات الموظفين في الخروج المؤقت</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{stats.totalStaff}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">موظف مخالف</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{stats.totalViolations}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">إجمالي المخالفات</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Timer className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{formatDelay(stats.totalDelayMinutes)}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">إجمالي التأخير</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.critical}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">حالة خطيرة (5+ مخالفة)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم الموظف..."
            className="w-full pr-11 pl-4 py-3 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('violations')}
            className={cn(
              'px-4 py-2.5 rounded-xl text-sm font-medium transition-colors',
              sortBy === 'violations'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-stone-600'
            )}
          >
            حسب عدد المخالفات
          </button>
          <button
            onClick={() => setSortBy('delay')}
            className={cn(
              'px-4 py-2.5 rounded-xl text-sm font-medium transition-colors',
              sortBy === 'delay'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-stone-600'
            )}
          >
            حسب مدة التأخير
          </button>
        </div>
      </div>

      {/* Violations List */}
      {violationsList.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-lg font-semibold text-stone-700 dark:text-stone-300">لا توجد مخالفات</p>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">جميع الموظفين ملتزمين بأوقات الخروج</p>
        </div>
      ) : (
        <div className="space-y-3">
          {violationsList.map((v, index) => {
            const severity = getSeverity(v.totalViolations);
            const isExpanded = expandedStaff.has(v.staffId);

            return (
              <motion.div
                key={v.staffId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={cn(
                  'bg-white dark:bg-stone-900 rounded-2xl border shadow-sm overflow-hidden transition-all',
                  v.totalViolations >= 5
                    ? 'border-red-300 dark:border-red-800 ring-1 ring-red-200/50 dark:ring-red-900/30'
                    : v.totalViolations >= 3
                      ? 'border-orange-300 dark:border-orange-800'
                      : 'border-stone-200 dark:border-stone-800'
                )}
              >
                {/* Header */}
                <button
                  onClick={() => toggleExpand(v.staffId)}
                  className="w-full flex items-center justify-between p-4 text-right hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={cn(
                      'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
                      v.totalViolations >= 5
                        ? 'bg-red-100 dark:bg-red-900/30'
                        : v.totalViolations >= 3
                          ? 'bg-orange-100 dark:bg-orange-900/30'
                          : 'bg-amber-100 dark:bg-amber-900/30'
                    )}>
                      <User className={cn(
                        'w-5 h-5',
                        v.totalViolations >= 5
                          ? 'text-red-600 dark:text-red-400'
                          : v.totalViolations >= 3
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-amber-600 dark:text-amber-400'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-stone-900 dark:text-white truncate">{v.staffName}</span>
                        <span className="text-xs text-stone-400">
                          ({v.staffRole === 'driver' ? 'سائق' : 'مساعد'})
                        </span>
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', severity.bgColor, severity.color)}>
                          <AlertTriangle className="w-3 h-3" />
                          {severity.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-stone-500 dark:text-stone-400">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {v.totalViolations} مخالفة
                        </span>
                        <span className="flex items-center gap-1">
                          <Timer className="w-3.5 h-3.5" />
                          تأخير {formatDelay(v.totalDelayMinutes)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-stone-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-stone-400 flex-shrink-0" />
                  )}
                </button>

                {/* Expanded Records */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-2 border-t border-stone-100 dark:border-stone-800 pt-3">
                        {v.records.map((rec, i) => (
                          <div
                            key={`${rec.requestId}-${i}`}
                            className={cn(
                              'flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm',
                              rec.returned
                                ? 'bg-amber-50 dark:bg-amber-900/10'
                                : 'bg-red-50 dark:bg-red-900/10'
                            )}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Calendar className="w-4 h-4 text-stone-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-stone-700 dark:text-stone-300">
                                    {new Date(rec.exitDate).toLocaleDateString('ar-IQ', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </span>
                                  <span className="text-stone-400 text-xs">
                                    {new Date(rec.exitDate).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {rec.exitReason && (
                                    <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                                      {rec.exitReason}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                                  <span>المدة المسموحة: {rec.allowedMinutes} دقيقة</span>
                                  <span className="text-stone-300 dark:text-stone-600">|</span>
                                  <span className={cn(
                                    'font-semibold',
                                    rec.returned ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                                  )}>
                                    تأخير: {rec.delayText}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <span className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0',
                              rec.returned
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            )}>
                              {rec.returned ? (
                                <>
                                  <Clock className="w-3 h-3" />
                                  عاد متأخراً
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="w-3 h-3" />
                                  لم يعُد بعد
                                </>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
