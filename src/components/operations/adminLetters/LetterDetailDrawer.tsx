import { useEffect, useState } from 'react';
import { X, Download, PenLine, Archive, Trash2, Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';
import {
  ARCHIVE_STATUS_LABELS,
  LETTER_TYPE_LABELS,
  operationsAdminLettersRepository,
  type AdminLetter,
  type AdminLetterActivity,
} from '../../../data/repositories/operationsAdminLettersRepository';

interface LetterDetailDrawerProps {
  letter: AdminLetter | null;
  open: boolean;
  onClose: () => void;
  onEdit: (letter: AdminLetter) => void;
  onToggleSigned: (letter: AdminLetter) => void;
  onArchive: (letter: AdminLetter) => void;
  onRestore: (letter: AdminLetter) => void;
  onDelete: (letter: AdminLetter) => void;
  relatedLetter?: AdminLetter | null;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'إنشاء',
  update: 'تعديل',
  signed: 'توقيع',
  unsigned: 'إلغاء توقيع',
  archive: 'أرشفة',
  upload: 'رفع ملف',
  delete: 'حذف',
};

export default function LetterDetailDrawer({
  letter,
  open,
  onClose,
  onEdit,
  onToggleSigned,
  onArchive,
  onRestore,
  onDelete,
  relatedLetter,
}: LetterDetailDrawerProps) {
  const [activity, setActivity] = useState<AdminLetterActivity[]>([]);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  useEffect(() => {
    if (!open || !letter) return;

    void operationsAdminLettersRepository.listActivity(letter.id).then(setActivity);

    if (letter.file_path) {
      setLoadingFile(true);
      void operationsAdminLettersRepository
        .getLetterFileUrl(letter.file_path)
        .then(setFileUrl)
        .finally(() => setLoadingFile(false));
    } else {
      setFileUrl(null);
    }
  }, [open, letter]);

  if (!open || !letter) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-cyan-600">{letter.letter_number}</p>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">{letter.subject}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <div>
              <p className="text-slate-500">النوع</p>
              <p className="font-bold">{LETTER_TYPE_LABELS[letter.letter_type]}</p>
            </div>
            <div>
              <p className="text-slate-500">التاريخ</p>
              <p className="font-bold">{letter.letter_date}</p>
            </div>
            <div>
              <p className="text-slate-500">الجهة</p>
              <p className="font-bold">{letter.correspondent_entity || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500">الحالة</p>
              <p className="font-bold">{ARCHIVE_STATUS_LABELS[letter.archive_status]}</p>
            </div>
            <div>
              <p className="text-slate-500">التوقيع</p>
              <p className="font-bold">{letter.is_signed ? `موقّع — ${letter.signed_by}` : 'بانتظار التوقيع'}</p>
            </div>
            {letter.reference_number ? (
              <div>
                <p className="text-slate-500">المرجع</p>
                <p className="font-bold">{letter.reference_number}</p>
              </div>
            ) : null}
          </div>

          {letter.content_summary ? (
            <div>
              <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">الملخص</p>
              <p className="leading-relaxed text-slate-600 dark:text-slate-300">{letter.content_summary}</p>
            </div>
          ) : null}

          {relatedLetter ? (
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-800 dark:bg-cyan-900/20">
              <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">كتاب مرتبط</p>
              <p className="font-bold">{relatedLetter.letter_number} — {relatedLetter.subject}</p>
            </div>
          ) : null}

          {letter.requires_response ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
              <p className="font-semibold text-amber-800 dark:text-amber-200">يحتاج رد</p>
              {letter.response_due_date ? (
                <p className="text-sm">موعد الرد: {letter.response_due_date}</p>
              ) : null}
            </div>
          ) : null}

          {letter.tags?.length ? (
            <div className="flex flex-wrap gap-2">
              {letter.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold dark:bg-slate-700">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {letter.notes ? (
            <div>
              <p className="mb-1 font-semibold">ملاحظات</p>
              <p className="text-slate-600 dark:text-slate-300">{letter.notes}</p>
            </div>
          ) : null}

          {letter.file_name ? (
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="mb-2 font-semibold">المرفق</p>
              <p className="mb-2 text-sm">{letter.file_name}</p>
              {loadingFile ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : fileUrl ? (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-bold text-cyan-600 hover:underline"
                >
                  <Download className="h-4 w-4" />
                  تحميل / معاينة الملف
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => onEdit(letter)}>
              تعديل
            </Button>
            <Button type="button" variant="outline" onClick={() => onToggleSigned(letter)}>
              <PenLine className="h-4 w-4" />
              {letter.is_signed ? 'إلغاء التوقيع' : 'توقيع'}
            </Button>
            {letter.archive_status === 'archived' ? (
              <Button type="button" variant="outline" onClick={() => onRestore(letter)}>
                <Archive className="h-4 w-4" />
                استرجاع
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => onArchive(letter)}>
                <Archive className="h-4 w-4" />
                أرشفة
              </Button>
            )}
            <Button type="button" variant="outline" className="text-red-600" onClick={() => onDelete(letter)}>
              <Trash2 className="h-4 w-4" />
              حذف
            </Button>
          </div>

          {activity.length > 0 ? (
            <div>
              <p className="mb-2 font-bold">سجل النشاط</p>
              <div className="space-y-2">
                {activity.map((item) => (
                  <div key={item.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800">
                    <p className="font-bold">{ACTION_LABELS[item.action] ?? item.action}</p>
                    {item.details ? <p className="text-slate-600 dark:text-slate-300">{item.details}</p> : null}
                    <p className="mt-1 text-slate-400">{new Date(item.created_at).toLocaleString('ar-IQ')}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
