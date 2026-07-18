import { Search } from 'lucide-react';
import { Input } from '../../ui/input';
import {
  ARCHIVE_STATUS_LABELS,
  LETTER_TYPE_LABELS,
  type AdminLetterArchiveStatus,
  type AdminLetterFilters,
  type AdminLetterType,
} from '../../../data/repositories/operationsAdminLettersRepository';

interface LetterFiltersBarProps {
  filters: AdminLetterFilters;
  onChange: (filters: AdminLetterFilters) => void;
}

const TYPE_TABS: { value: AdminLetterType | 'all'; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'outgoing', label: LETTER_TYPE_LABELS.outgoing },
  { value: 'incoming', label: LETTER_TYPE_LABELS.incoming },
  { value: 'internal', label: LETTER_TYPE_LABELS.internal },
  { value: 'decision', label: LETTER_TYPE_LABELS.decision },
  { value: 'circular', label: LETTER_TYPE_LABELS.circular },
  { value: 'memo', label: LETTER_TYPE_LABELS.memo },
];

export default function LetterFiltersBar({ filters, onChange }: LetterFiltersBarProps) {
  function patch(partial: Partial<AdminLetterFilters>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-cyan-200/40 bg-white/80 p-4 dark:border-cyan-800/40 dark:bg-slate-900/60">
      <div className="flex flex-wrap gap-2">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => patch({ letterType: tab.value })}
            className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-colors ${
              (filters.letterType ?? 'all') === tab.value
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="relative xl:col-span-2">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={filters.search ?? ''}
            onChange={(e) => patch({ search: e.target.value })}
            placeholder="بحث بالموضوع، الرقم، الجهة، المرجع..."
            className="pr-10"
          />
        </div>

        <select
          value={filters.archiveStatus ?? 'all'}
          onChange={(e) => patch({ archiveStatus: e.target.value as AdminLetterArchiveStatus | 'all' })}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="all">كل الحالات</option>
          {(Object.keys(ARCHIVE_STATUS_LABELS) as AdminLetterArchiveStatus[]).map((status) => (
            <option key={status} value={status}>
              {ARCHIVE_STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <select
          value={filters.signed ?? 'all'}
          onChange={(e) => patch({ signed: e.target.value as AdminLetterFilters['signed'] })}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="all">كل التوقيعات</option>
          <option value="signed">موقّع</option>
          <option value="unsigned">بانتظار التوقيع</option>
        </select>

        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
          <input
            type="checkbox"
            checked={!!filters.requiresResponse}
            onChange={(e) => patch({ requiresResponse: e.target.checked || undefined })}
          />
          يحتاج رد فقط
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Input
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => patch({ dateFrom: e.target.value || undefined })}
          placeholder="من تاريخ"
        />
        <Input
          type="date"
          value={filters.dateTo ?? ''}
          onChange={(e) => patch({ dateTo: e.target.value || undefined })}
          placeholder="إلى تاريخ"
        />
      </div>
    </div>
  );
}
