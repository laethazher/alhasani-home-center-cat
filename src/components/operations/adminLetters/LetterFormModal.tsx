import { useEffect, useState } from 'react';
import { X, Upload, Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  LETTER_TYPE_LABELS,
  operationsAdminLettersRepository,
  type AdminLetter,
  type AdminLetterType,
  type CreateAdminLetterPayload,
} from '../../../data/repositories/operationsAdminLettersRepository';

interface LetterFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  userId?: string;
  editLetter?: AdminLetter | null;
  relatedLetters?: AdminLetter[];
}

export default function LetterFormModal({
  open,
  onClose,
  onSaved,
  userId,
  editLetter,
  relatedLetters = [],
}: LetterFormModalProps) {
  const [letterType, setLetterType] = useState<AdminLetterType>('outgoing');
  const [subject, setSubject] = useState('');
  const [contentSummary, setContentSummary] = useState('');
  const [correspondentEntity, setCorrespondentEntity] = useState('');
  const [letterDate, setLetterDate] = useState(new Date().toISOString().slice(0, 10));
  const [referenceNumber, setReferenceNumber] = useState('');
  const [letterNumber, setLetterNumber] = useState('');
  const [requiresResponse, setRequiresResponse] = useState(false);
  const [responseDueDate, setResponseDueDate] = useState('');
  const [relatedLetterId, setRelatedLetterId] = useState<number | ''>('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewNumber, setPreviewNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (editLetter) {
      setLetterType(editLetter.letter_type);
      setSubject(editLetter.subject);
      setContentSummary(editLetter.content_summary ?? '');
      setCorrespondentEntity(editLetter.correspondent_entity ?? '');
      setLetterDate(editLetter.letter_date);
      setReferenceNumber(editLetter.reference_number ?? '');
      setLetterNumber(editLetter.letter_number);
      setRequiresResponse(editLetter.requires_response);
      setResponseDueDate(editLetter.response_due_date ?? '');
      setRelatedLetterId(editLetter.related_letter_id ?? '');
      setTags((editLetter.tags ?? []).join(', '));
      setNotes(editLetter.notes ?? '');
      setPreviewNumber(editLetter.letter_number);
    } else {
      setLetterType('outgoing');
      setSubject('');
      setContentSummary('');
      setCorrespondentEntity('');
      setLetterDate(new Date().toISOString().slice(0, 10));
      setReferenceNumber('');
      setLetterNumber('');
      setRequiresResponse(false);
      setResponseDueDate('');
      setRelatedLetterId('');
      setTags('');
      setNotes('');
      setPreviewNumber('');
    }
    setFile(null);
    setError(null);
  }, [open, editLetter]);

  useEffect(() => {
    if (!open || editLetter || letterType !== 'outgoing') {
      setPreviewNumber('');
      return;
    }
    setPreviewNumber('يُولّد تلقائياً عند الحفظ');
  }, [open, editLetter, letterType]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) {
      setError('الموضوع مطلوب');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: CreateAdminLetterPayload = {
        letter_type: letterType,
        subject,
        content_summary: contentSummary || null,
        correspondent_entity: correspondentEntity || null,
        letter_date: letterDate,
        reference_number: referenceNumber || null,
        letter_number: letterType !== 'outgoing' ? letterNumber || undefined : undefined,
        requires_response: requiresResponse,
        response_due_date: requiresResponse ? responseDueDate || null : null,
        related_letter_id: relatedLetterId ? Number(relatedLetterId) : null,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        notes: notes || null,
        created_by: userId ?? null,
      };

      let saved: AdminLetter;
      const isNew = !editLetter;
      if (editLetter) {
        saved = await operationsAdminLettersRepository.updateLetter(editLetter.id, payload, userId);
      } else {
        saved = await operationsAdminLettersRepository.createLetter(payload);
      }

      try {
        if (file) {
          saved = await operationsAdminLettersRepository.uploadLetterFile(saved, file, userId);
        }
      } catch (uploadErr) {
        if (isNew) {
          await operationsAdminLettersRepository.deleteLetter(saved.id, userId).catch(() => undefined);
        }
        const msg = uploadErr instanceof Error ? uploadErr.message : '';
        if (msg.toLowerCase().includes('invalid key')) {
          throw new Error('تعذّر رفع الملف. تم استخدام اسم ملف آمن تلقائياً — أعد المحاولة.');
        }
        throw uploadErr;
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حفظ الكتاب');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            {editLetter ? 'تعديل كتاب' : 'إضافة كتاب جديد'}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold">نوع الكتاب</label>
              <select
                value={letterType}
                onChange={(e) => setLetterType(e.target.value as AdminLetterType)}
                disabled={!!editLetter}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {(Object.keys(LETTER_TYPE_LABELS) as AdminLetterType[]).map((type) => (
                  <option key={type} value={type}>
                    {LETTER_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold">رقم الكتاب</label>
              {letterType === 'outgoing' && !editLetter ? (
                <Input value={previewNumber} readOnly className="font-mono bg-slate-50 dark:bg-slate-800" />
              ) : (
                <Input
                  value={letterNumber}
                  onChange={(e) => setLetterNumber(e.target.value)}
                  placeholder="رقم الكتاب"
                  className="font-mono"
                />
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">الموضوع *</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="موضوع الكتاب" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">ملخص المحتوى</label>
            <textarea
              value={contentSummary}
              onChange={(e) => setContentSummary(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              placeholder="ملخص أو محتوى مختصر للكتاب"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold">الجهة</label>
              <Input
                value={correspondentEntity}
                onChange={(e) => setCorrespondentEntity(e.target.value)}
                placeholder="الجهة المرسلة / المستلمة"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">تاريخ الكتاب</label>
              <Input type="date" value={letterDate} onChange={(e) => setLetterDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold">رقم مرجعي خارجي</label>
              <Input
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="للكتب الواردة"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">كتاب مرتبط</label>
              <select
                value={relatedLetterId}
                onChange={(e) => setRelatedLetterId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">— لا يوجد —</option>
                {relatedLetters
                  .filter((l) => l.id !== editLetter?.id)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.letter_number} — {l.subject}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={requiresResponse}
              onChange={(e) => setRequiresResponse(e.target.checked)}
            />
            يحتاج رد
          </label>

          {requiresResponse ? (
            <div>
              <label className="mb-1 block text-sm font-semibold">موعد الرد المطلوب</label>
              <Input
                type="date"
                value={responseDueDate}
                onChange={(e) => setResponseDueDate(e.target.value)}
              />
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-sm font-semibold">وسوم (مفصولة بفاصلة)</label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="مثال: عاجل, متابعة" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">ملاحظات داخلية</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">رفع ملف (PDF / Word / صورة)</label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm dark:border-slate-600">
              <Upload className="h-4 w-4" />
              {file ? file.name : editLetter?.file_name ? `الملف الحالي: ${editLetter.file_name}` : 'اختر ملفاً'}
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editLetter ? 'حفظ التعديلات' : 'إضافة الكتاب'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
