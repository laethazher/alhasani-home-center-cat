import { Archive, CheckCircle2, Eye, PenLine, RotateCcw } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  ARCHIVE_STATUS_LABELS,
  LETTER_TYPE_LABELS,
  type AdminLetter,
} from '../../../data/repositories/operationsAdminLettersRepository';

interface LetterListTableProps {
  letters: AdminLetter[];
  loading?: boolean;
  onView: (letter: AdminLetter) => void;
  onToggleSigned: (letter: AdminLetter) => void;
  onArchive: (letter: AdminLetter) => void;
  onRestore: (letter: AdminLetter) => void;
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold', className)}>
      {children}
    </span>
  );
}

export default function LetterListTable({
  letters,
  loading,
  onView,
  onToggleSigned,
  onArchive,
  onRestore,
}: LetterListTableProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
        جاري تحميل الأرشيف...
      </div>
    );
  }

  if (letters.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">لا توجد كتب مطابقة</p>
        <p className="mt-1 text-sm text-slate-500">أضف كتاباً جديداً أو غيّر معايير البحث</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <tr>
            <th className="px-4 py-3 text-right font-bold">الرقم</th>
            <th className="px-4 py-3 text-right font-bold">النوع</th>
            <th className="px-4 py-3 text-right font-bold">الموضوع</th>
            <th className="px-4 py-3 text-right font-bold">الجهة</th>
            <th className="px-4 py-3 text-right font-bold">التاريخ</th>
            <th className="px-4 py-3 text-right font-bold">التوقيع</th>
            <th className="px-4 py-3 text-right font-bold">الحالة</th>
            <th className="px-4 py-3 text-right font-bold">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {letters.map((letter) => (
            <tr key={letter.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-4 py-3 font-mono text-xs font-bold">{letter.letter_number}</td>
              <td className="px-4 py-3">
                <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200">
                  {LETTER_TYPE_LABELS[letter.letter_type]}
                </Badge>
              </td>
              <td className="max-w-xs px-4 py-3">
                <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{letter.subject}</p>
                {letter.reference_number ? (
                  <p className="truncate text-xs text-slate-500">مرجع: {letter.reference_number}</p>
                ) : null}
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{letter.correspondent_entity || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap">{letter.letter_date}</td>
              <td className="px-4 py-3">
                {letter.is_signed ? (
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                    <CheckCircle2 className="ml-1 inline h-3 w-3" />
                    موقّع
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                    <PenLine className="ml-1 inline h-3 w-3" />
                    بانتظار
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge
                  className={
                    letter.archive_status === 'archived'
                      ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                      : letter.archive_status === 'expired'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                  }
                >
                  {ARCHIVE_STATUS_LABELS[letter.archive_status]}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => onView(letter)}
                    className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    title="عرض"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleSigned(letter)}
                    className="rounded-lg bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300"
                    title={letter.is_signed ? 'إلغاء التوقيع' : 'توقيع'}
                  >
                    <PenLine className="h-4 w-4" />
                  </button>
                  {letter.archive_status === 'archived' ? (
                    <button
                      type="button"
                      onClick={() => onRestore(letter)}
                      className="rounded-lg bg-blue-50 p-2 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                      title="استرجاع"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onArchive(letter)}
                      className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      title="أرشفة"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
