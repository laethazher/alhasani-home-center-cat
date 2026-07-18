import React, { useState } from 'react';
import { X, SlidersHorizontal, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AdvancedFilterState, AttendanceFilterStatus } from '../types';
import { quickRangeToDates, type QuickCalendarRange } from '../utils/dateUtils';

const STATUS_OPTIONS: { value: AttendanceFilterStatus; label: string }[] = [
  { value: 'present', label: 'حاضر' },
  { value: 'late', label: 'متأخر' },
  { value: 'absent', label: 'غائب' },
  { value: 'full_leave', label: 'إجازة كاملة' },
  { value: 'time_leave', label: 'إجازة زمنية' },
  { value: 'break', label: 'استراحه' },
];

export interface AdvancedFilterPanelProps {
  open: boolean;
  onClose: () => void;
  state: AdvancedFilterState;
  setField: <K extends keyof AdvancedFilterState>(key: K, value: AdvancedFilterState[K]) => void;
  /** تطبيق نص بحث طبيعي على الحقول */
  onApplyNaturalLanguage?: (text: string) => void;
  className?: string;
}

export function AdvancedFilterPanel({
  open,
  onClose,
  state,
  setField,
  onApplyNaturalLanguage,
  className,
}: AdvancedFilterPanelProps) {
  const [nlDraft, setNlDraft] = useState('');

  const applyQuickRange = (kind: QuickCalendarRange) => {
    const { from, to } = quickRangeToDates(kind);
    setField('dateFrom', from);
    setField('dateTo', to);
  };

  const toggleStatus = (v: AttendanceFilterStatus) => {
    setField(
      'statuses',
      state.statuses.includes(v) ? state.statuses.filter((s) => s !== v) : [...state.statuses, v]
    );
  };

  const applyNl = () => {
    const t = nlDraft.trim();
    if (!t || !onApplyNaturalLanguage) return;
    onApplyNaturalLanguage(t);
    setNlDraft('');
  };

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="إغلاق الفلاتر"
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed top-0 right-0 z-[70] h-full w-full max-w-md shadow-2xl',
          'bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-700',
          'flex flex-col overflow-hidden',
          className
        )}
        dir="rtl"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-stone-200 dark:border-stone-700">
          <div className="flex items-center gap-2 text-stone-900 dark:text-white">
            <SlidersHorizontal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-bold">فلاتر متقدمة</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {onApplyNaturalLanguage ? (
            <section className="space-y-2">
              <label className="text-xs font-bold text-stone-500 dark:text-stone-400">بحث طبيعي (لصق)</label>
              <textarea
                value={nlDraft}
                onChange={(e) => setNlDraft(e.target.value)}
                rows={2}
                placeholder="مثال: متأخر هذا الأسبوع، لوحة 12345"
                className={cn(
                  'w-full rounded-xl border border-stone-300 dark:border-stone-600',
                  'bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm text-stone-900 dark:text-white',
                  'focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none resize-none'
                )}
              />
              <button
                type="button"
                onClick={applyNl}
                disabled={!nlDraft.trim()}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold',
                  'bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:pointer-events-none'
                )}
              >
                <Sparkles className="w-4 h-4" />
                تطبيق على الحقول
              </button>
            </section>
          ) : null}

          <section className="space-y-2">
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400">نطاق سريع</span>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['today', 'اليوم'],
                  ['this_week', 'هذا الأسبوع'],
                  ['this_month', 'هذا الشهر'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => applyQuickRange(k)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                    'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40',
                    'text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs font-bold text-stone-500 dark:text-stone-400 block mb-1">من تاريخ</label>
              <input
                type="date"
                value={state.dateFrom}
                onChange={(e) => setField('dateFrom', e.target.value)}
                className={cn(
                  'w-full rounded-xl border border-stone-300 dark:border-stone-600',
                  'bg-white dark:bg-stone-800 px-3 py-2 text-sm text-stone-900 dark:text-white'
                )}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-stone-500 dark:text-stone-400 block mb-1">إلى تاريخ</label>
              <input
                type="date"
                value={state.dateTo}
                onChange={(e) => setField('dateTo', e.target.value)}
                className={cn(
                  'w-full rounded-xl border border-stone-300 dark:border-stone-600',
                  'bg-white dark:bg-stone-800 px-3 py-2 text-sm text-stone-900 dark:text-white'
                )}
              />
            </div>
          </section>

          <section className="space-y-2">
            <label className="text-xs font-bold text-stone-500 dark:text-stone-400">الاسم يحتوي</label>
            <input
              type="text"
              value={state.name}
              onChange={(e) => setField('name', e.target.value)}
              className={cn(
                'w-full rounded-xl border border-stone-300 dark:border-stone-600',
                'bg-white dark:bg-stone-800 px-3 py-2 text-sm text-stone-900 dark:text-white'
              )}
            />
          </section>

          <section className="space-y-2">
            <label className="text-xs font-bold text-stone-500 dark:text-stone-400">لوحة / مركبة</label>
            <input
              type="text"
              value={state.plate}
              onChange={(e) => setField('plate', e.target.value)}
              className={cn(
                'w-full rounded-xl border border-stone-300 dark:border-stone-600',
                'bg-white dark:bg-stone-800 px-3 py-2 text-sm text-stone-900 dark:text-white'
              )}
            />
          </section>

          <section className="space-y-2">
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400">الدور</span>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['all', 'الكل'],
                  ['driver', 'سائق'],
                  ['assistant', 'مساعد'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setField('role', k)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                    state.role === k
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400">حالات الحضور</span>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleStatus(value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                    state.statuses.includes(value)
                      ? 'border-emerald-500 bg-emerald-600 text-white'
                      : 'border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-stone-500 dark:text-stone-400 block mb-1">تأخير من (دقيقة)</label>
              <input
                type="number"
                min={0}
                value={state.delayMin}
                onChange={(e) => setField('delayMin', e.target.value)}
                className={cn(
                  'w-full rounded-xl border border-stone-300 dark:border-stone-600',
                  'bg-white dark:bg-stone-800 px-3 py-2 text-sm text-stone-900 dark:text-white'
                )}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-stone-500 dark:text-stone-400 block mb-1">تأخير إلى (دقيقة)</label>
              <input
                type="number"
                min={0}
                value={state.delayMax}
                onChange={(e) => setField('delayMax', e.target.value)}
                className={cn(
                  'w-full rounded-xl border border-stone-300 dark:border-stone-600',
                  'bg-white dark:bg-stone-800 px-3 py-2 text-sm text-stone-900 dark:text-white'
                )}
              />
            </div>
          </section>
        </div>

        <div className="p-4 border-t border-stone-200 dark:border-stone-700">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700"
          >
            تم
          </button>
        </div>
      </aside>
    </>
  );
}
