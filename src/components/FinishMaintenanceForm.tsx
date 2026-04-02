import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { getDepartmentClient, getDepartmentTables } from '../data/supabaseSource';
import type { DepartmentCode } from '../data/department';
import type { MaintenanceRequest, SparePart } from '../lib/supabaseClient';

const MAINTENANCE_TYPES = [
  'صيانة عامة', 'تغيير زيت', 'فلتر زيت', 'فلتر هواء', 'فحص الفرامل',
  'فحص شامل', 'إصلاح محرك', 'إصلاح كهربائي', 'إصلاح إطارات', 'صيانة مكيف',
  'إصلاح ناقل الحركة', 'أخرى',
];

interface Props {
  request: MaintenanceRequest;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  department?: DepartmentCode;
}

export default function FinishMaintenanceForm({ request, open, onClose, onDone, department = 'tajhiz' }: Props) {
  const supabase = getDepartmentClient(department);
  const tables = getDepartmentTables(department);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [maintenanceType, setMaintenanceType] = useState(request.maintenance_type);
  const [faultDescription, setFaultDescription] = useState(request.description ?? '');
  const [workDone, setWorkDone] = useState('');
  const [inspectionOnly, setInspectionOnly] = useState(false);
  const [partsReplaced, setPartsReplaced] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedParts, setSelectedParts] = useState<{ partId: number; qty: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fetchParts = useCallback(async () => {
    const { data } = await supabase.from(tables.spareParts).select('*').gt('quantity', 0);
    if (data) setSpareParts(data);
  }, [supabase, tables]);

  useEffect(() => {
    if (!open) return;
    setMaintenanceType(request.maintenance_type);
    setFaultDescription(request.description ?? '');
    setWorkDone('');
    setInspectionOnly(false);
    setPartsReplaced('');
    setTechnicianName('');
    setCost('');
    setNotes('');
    setSelectedParts([]);
    setSubmitting(false);
    setSubmitError('');
    fetchParts();
  }, [open, request, fetchParts]);

  function addPart(partId: number) {
    if (selectedParts.some(p => p.partId === partId)) return;
    setSelectedParts(prev => [...prev, { partId, qty: 1 }]);
  }

  function removePart(partId: number) {
    setSelectedParts(prev => prev.filter(p => p.partId !== partId));
  }

  function updatePartQty(partId: number, raw: number) {
    const qty = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
    setSelectedParts(prev => prev.map(p => p.partId === partId ? { ...p, qty } : p));
  }

  async function handleSubmit() {
    setSubmitError('');
    setSubmitting(true);

    const durationMs = request.started_at ? Date.now() - new Date(request.started_at).getTime() : 0;
    const durationMinutes = Math.round(durationMs / 60000);

    const sparePartsPayload = selectedParts.map(sp => ({
      part_id: sp.partId,
      quantity: sp.qty,
    }));

    const rpcName = department === 'installation' ? 'installation_finish_maintenance' : 'finish_maintenance';
    const { data, error } = await supabase.rpc(rpcName, {
      p_request_id: request.id,
      p_maintenance_type: maintenanceType,
      p_fault_description: faultDescription,
      p_work_done: workDone,
      p_inspection_only: inspectionOnly,
      p_parts_replaced: partsReplaced || null,
      p_technician_name: technicianName || null,
      p_cost: Number(cost) || 0,
      p_duration_minutes: durationMinutes,
      p_notes: notes || null,
      p_spare_parts: sparePartsPayload,
    });

    if (error) {
      setSubmitError(error.message || 'فشل في إنهاء الصيانة');
      setSubmitting(false);
      return;
    }

    const result = data as { success?: boolean; error?: string };
    if (!result?.success) {
      const err = result?.error || '';
      const errMsg =
        err === 'duplicate_record' ? 'تم إنهاء هذه الصيانة مسبقاً' :
        err.startsWith('unauthorized') ? 'غير مصرح لك بالقيام بهذا الإجراء. تأكد من تسجيل الدخول بحساب صحيح.' :
        err || 'فشل في إنهاء الصيانة';
      setSubmitError(errMsg);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onDone();
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black z-40"
      />
      <motion.div
        initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
        className="fixed inset-x-4 top-[3%] bottom-[3%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-xl z-50 bg-white dark:bg-stone-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800">
          <h2 className="text-lg font-bold text-stone-900 dark:text-white">إنهاء الصيانة</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">نوع الصيانة</label>
            <select value={maintenanceType} onChange={e => setMaintenanceType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm">
              {MAINTENANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">وصف العطل</label>
            <textarea value={faultDescription} onChange={e => setFaultDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">ما الذي تم عمله</label>
            <textarea value={workDone} onChange={e => setWorkDone(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm resize-none"
              placeholder="وصف الأعمال المنجزة..." />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={inspectionOnly} onChange={e => setInspectionOnly(e.target.checked)}
              className="w-4 h-4 rounded border-stone-300" />
            <span className="text-sm text-stone-700 dark:text-stone-300">فحص فقط (بدون إصلاح)</span>
          </label>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">القطع التي تم تبديلها</label>
            <input value={partsReplaced} onChange={e => setPartsReplaced(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm"
              placeholder="مثال: فلتر زيت، سير مروحة..." />
          </div>

          {/* Spare parts from inventory */}
          {spareParts.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">قطع غيار من المخزن</label>
              <select onChange={e => { if (e.target.value) addPart(Number(e.target.value)); e.target.value = ''; }}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm mb-2">
                <option value="">إضافة قطعة...</option>
                {spareParts.filter(p => !selectedParts.some(sp => sp.partId === p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.name} (متوفر: {p.quantity})</option>
                ))}
              </select>
              {selectedParts.length > 0 && (
                <div className="space-y-2">
                  {selectedParts.map(sp => {
                    const part = spareParts.find(p => p.id === sp.partId);
                    return part ? (
                      <div key={sp.partId} className="flex items-center gap-2 p-2 rounded-xl bg-stone-50 dark:bg-stone-800/50">
                        <span className="flex-1 text-sm">{part.name}</span>
                        <input type="number" min={1} max={part.quantity} value={sp.qty}
                          onChange={e => updatePartQty(sp.partId, Number(e.target.value))}
                          className="w-16 px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-700 text-sm text-center" />
                        <button onClick={() => removePart(sp.partId)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">اسم الفني</label>
              <input value={technicianName} onChange={e => setTechnicianName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm"
                placeholder="اسم الفني..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">التكلفة (د.ع)</label>
              <input type="number" value={cost} onChange={e => setCost(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm"
                placeholder="0" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">ملاحظات</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm resize-none" />
          </div>
        </div>

        {submitError && (
          <div className="mx-5 mb-0 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
          </div>
        )}
        <div className="px-5 py-4 border-t border-stone-200 dark:border-stone-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-sm font-medium">
            إلغاء
          </button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {submitting ? 'جاري الحفظ...' : 'إنهاء وحفظ'}
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
