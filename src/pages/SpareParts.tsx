import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Search, Package, Edit2, Trash2, AlertTriangle,
  Save, Loader2, Hash, Building2, DollarSign, Layers,
  Download, Printer,
} from 'lucide-react';
import { BulkDeleteSelectedButton } from '../components/BulkDeleteSelectedButton';
import { cn } from '../lib/utils';
import { getDepartmentClient, getDepartmentTables } from '../data/supabaseSource';
import type { DepartmentCode } from '../data/department';
import type { SparePart, SparePartUsage, UserProfile } from '../lib/supabaseClient';
import { exportHtmlToPdf } from '../lib/pdfExport';
import { exportToExcel } from '../lib/excelExport';

const LOW_STOCK_THRESHOLD = 5;

interface Props {
  department?: DepartmentCode;
  profile?: UserProfile | null;
}

export default function SpareParts({ department = 'tajhiz', profile = null }: Props) {
  const supabase = getDepartmentClient(department);
  const tables = getDepartmentTables(department);
  const canDelete = profile?.role === 'admin';
  const [parts, setParts] = useState<SparePart[]>([]);
  const [usage, setUsage] = useState<SparePartUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredParts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredParts.map((p) => p.id));
    }
  };

  const togglePartSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  async function handleDeleteSelected() {
    if (!canDelete) return;
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const { error } = await supabase.from(tables.spareParts).delete().in('id', selectedIds);
      if (error) throw error;
      setSelectedIds([]);
      setIsSelectionMode(false);
      await fetchData();
    } catch (e) {
      alert('فشل الحذف: ' + (e instanceof Error ? e.message : 'خطأ'));
    } finally {
      setBulkDeleting(false);
    }
  }

  // Form state
  const [formName, setFormName] = useState('');
  const [formPartNumber, setFormPartNumber] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [partsRes, usageRes] = await Promise.all([
      supabase.from(tables.spareParts).select('*').order('name'),
      supabase.from(tables.sparePartUsage).select('*'),
    ]);
    if (partsRes.data) setParts(partsRes.data);
    if (usageRes.data) setUsage(usageRes.data);
    setLoading(false);
  }, [supabase, tables]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredParts = useMemo(() => {
    if (!searchQuery.trim()) return parts;
    const q = searchQuery.trim().toLowerCase();
    return parts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.part_number?.toLowerCase().includes(q) ||
      p.supplier?.toLowerCase().includes(q)
    );
  }, [parts, searchQuery]);

  const lowStockParts = useMemo(() => parts.filter(p => p.quantity <= LOW_STOCK_THRESHOLD), [parts]);

  function getPartUsageCount(partId: number) {
    return usage.filter(u => u.part_id === partId).reduce((s, u) => s + u.quantity_used, 0);
  }

  function openEditForm(part: SparePart) {
    setEditingPart(part);
    setFormName(part.name);
    setFormPartNumber(part.part_number ?? '');
    setFormSupplier(part.supplier ?? '');
    setFormPrice(String(part.price));
    setFormQuantity(String(part.quantity));
    setFormNotes(part.notes ?? '');
    setShowForm(true);
  }

  function openNewForm() {
    setEditingPart(null);
    setFormName('');
    setFormPartNumber('');
    setFormSupplier('');
    setFormPrice('');
    setFormQuantity('');
    setFormNotes('');
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!formName.trim()) return;
    setSubmitting(true);
    const data = {
      name: formName.trim(),
      part_number: formPartNumber.trim() || null,
      supplier: formSupplier.trim() || null,
      price: Number(formPrice) || 0,
      quantity: Number(formQuantity) || 0,
      notes: formNotes.trim() || null,
    };

    if (editingPart) {
      await supabase.from(tables.spareParts).update(data).eq('id', editingPart.id);
    } else {
      await supabase.from(tables.spareParts).insert(data);
    }
    setSubmitting(false);
    setShowForm(false);
    fetchData();
  }

  async function handleDelete(id: number) {
    if (!canDelete) return;
    await supabase.from(tables.spareParts).delete().eq('id', id);
    setDeleteConfirm(null);
    fetchData();
  }

  const totalValue = useMemo(() => parts.reduce((s, p) => s + p.price * p.quantity, 0), [parts]);

  /* ── Export ── */
  const exportExcel = () => {
    const toExport = isSelectionMode && selectedIds.length > 0
      ? filteredParts.filter((p) => selectedIds.includes(p.id))
      : filteredParts;

    if (toExport.length === 0) {
      alert('لا توجد قطع غيار للتصدير');
      return;
    }

    const headers = ['اسم القطعة', 'رقم القطعة', 'المورد', 'السعر (د.ع)', 'الكمية المتوفرة', 'عدد مرات الاستخدام', 'ملاحظات'];
    const rows = toExport.map(p => [
      p.name,
      p.part_number || '—',
      p.supplier || '—',
      p.price,
      p.quantity,
      getPartUsageCount(p.id),
      p.notes || '—'
    ]);
    const filename = `تقرير_قطع_الغيار_${new Date().toISOString().slice(0,10)}`;
    exportToExcel([headers, ...rows], filename, 'المخزن');
  };

  const exportPDF = async () => {
    const toExport = isSelectionMode && selectedIds.length > 0
      ? filteredParts.filter((p) => selectedIds.includes(p.id))
      : filteredParts;

    if (toExport.length === 0) {
      alert('لا توجد قطع غيار للتصدير');
      return;
    }

    const headers = ['القطعة', 'المورد', 'السعر', 'الكمية'];
    const rows = toExport.map(p => [
      p.name,
      p.supplier || '—',
      Number(p.price).toLocaleString(),
      p.quantity
    ]);

    let html = `
      <h1 style="text-align:center;font-size:22px;margin-bottom:12px">تقرير مخزون قطع الغيار</h1>
      <p style="text-align:center;color:#666;margin-bottom:20px">تاريخ التصدير: ${new Date().toLocaleDateString('ar-IQ')} | إجمالي عدد الأنواع: ${toExport.length}</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#2563eb;color:#fff">
          ${headers.map(h => `<th style="padding:8px;text-align:right">${h}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${rows.map((row, i) => `
            <tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">
              ${row.map(cell => `<td style="padding:6px 8px;border:1px solid #ddd">${cell}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    try {
      await exportHtmlToPdf(`<div dir="rtl">${html}</div>`, `قطع_الغيار_${Date.now()}.pdf`);
    } catch (e) {
      console.error(e);
      alert('فشل تصدير PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-3 text-center">
          <p className="text-2xl font-bold text-stone-900 dark:text-white">{parts.length}</p>
          <p className="text-xs text-stone-500">إجمالي القطع</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-3 text-center">
          <p className="text-2xl font-bold text-stone-900 dark:text-white">{parts.reduce((s, p) => s + p.quantity, 0)}</p>
          <p className="text-xs text-stone-500">إجمالي المخزون</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-3 text-center">
          <p className="text-2xl font-bold text-stone-900 dark:text-white">{totalValue.toLocaleString()}</p>
          <p className="text-xs text-stone-500">قيمة المخزون (د.ع)</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-3 text-center">
          <p className={cn('text-2xl font-bold', lowStockParts.length > 0 ? 'text-red-600' : 'text-emerald-600')}>{lowStockParts.length}</p>
          <p className="text-xs text-stone-500">مخزون منخفض</p>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockParts.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="text-sm text-red-700 dark:text-red-400">
            <span className="font-medium">تنبيه مخزون منخفض:</span>{' '}
            {lowStockParts.map(p => p.name).join('، ')}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 sm:max-w-xs w-full">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث عن قطعة..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              setSelectedIds([]);
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors",
              isSelectionMode ? "bg-stone-200 dark:bg-stone-700 border-stone-300 dark:border-stone-600" : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700"
            )}
          >
            {isSelectionMode ? 'إلغاء التحديد' : 'تحديد'}
          </button>

          {isSelectionMode && (
            <>
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-700 text-sm font-medium border border-stone-200 dark:border-stone-600"
              >
                {selectedIds.length === filteredParts.length ? 'إلغاء الكل' : 'تحديد الكل'}
              </button>
              
              {canDelete && (
                <BulkDeleteSelectedButton
                  selectedCount={selectedIds.length}
                  deleting={bulkDeleting}
                  confirmMessage={(n) => `هل أنت متأكد من حذف ${n} قطعة من قاعدة البيانات؟`}
                  onDelete={handleDeleteSelected}
                  label={(n) => `حذف (${n})`}
                />
              )}
            </>
          )}

          <button
            onClick={exportExcel}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" /> 
            {isSelectionMode && selectedIds.length > 0 ? `Excel (${selectedIds.length})` : 'Excel الكل'}
          </button>
          <button
            onClick={exportPDF}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium shadow-lg shadow-red-600/25 hover:bg-red-700 transition-colors"
          >
            <Printer className="w-4 h-4" /> 
            {isSelectionMode && selectedIds.length > 0 ? `PDF (${selectedIds.length})` : 'PDF الكل'}
          </button>
          {!isSelectionMode && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={openNewForm}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium shadow-lg shadow-blue-600/30"
            >
              <Plus className="w-4 h-4" /> إضافة قطعة غيار
            </motion.button>
          )}
        </div>
      </div>

      {/* Parts table */}
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50">
                {isSelectionMode && <th className="px-4 py-3 w-10"></th>}
                <th className="text-right px-4 py-3 font-medium text-stone-600 dark:text-stone-400">اسم القطعة</th>
                <th className="text-right px-4 py-3 font-medium text-stone-600 dark:text-stone-400 hidden sm:table-cell">رقم القطعة</th>
                <th className="text-right px-4 py-3 font-medium text-stone-600 dark:text-stone-400 hidden md:table-cell">المورد</th>
                <th className="text-right px-4 py-3 font-medium text-stone-600 dark:text-stone-400">السعر</th>
                <th className="text-right px-4 py-3 font-medium text-stone-600 dark:text-stone-400">الكمية</th>
                <th className="text-right px-4 py-3 font-medium text-stone-600 dark:text-stone-400 hidden lg:table-cell">الاستخدام</th>
                <th className="text-center px-4 py-3 font-medium text-stone-600 dark:text-stone-400">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-stone-400">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>لا توجد قطع غيار</p>
                  </td>
                </tr>
              )}
              {filteredParts.map(part => (
                <tr key={part.id} className={cn(
                  "border-b border-stone-100 dark:border-stone-800/50 hover:bg-stone-50 dark:hover:bg-stone-800/30 transition-colors",
                  selectedIds.includes(part.id) && "bg-blue-50 dark:bg-blue-900/10"
                )}>
                  {isSelectionMode && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(part.id)}
                        onChange={() => togglePartSelection(part.id)}
                        className="w-4 h-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="font-medium text-stone-900 dark:text-white">{part.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone-600 dark:text-stone-400 hidden sm:table-cell">{part.part_number ?? '—'}</td>
                  <td className="px-4 py-3 text-stone-600 dark:text-stone-400 hidden md:table-cell">{part.supplier ?? '—'}</td>
                  <td className="px-4 py-3 text-stone-900 dark:text-white">{Number(part.price).toLocaleString()} د.ع</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      part.quantity <= LOW_STOCK_THRESHOLD
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
                    )}>
                      {part.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-600 dark:text-stone-400 hidden lg:table-cell">{getPartUsageCount(part.id)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openEditForm(part)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {canDelete && deleteConfirm === part.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleDelete(part.id)} className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-500">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : canDelete ? (
                        <button
                          onClick={() => setDeleteConfirm(part.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="fixed inset-0 bg-black z-40"
            />
            <motion.div
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
              className="fixed inset-x-4 top-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md z-50 bg-white dark:bg-stone-900 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800">
                <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                  {editingPart ? 'تعديل قطعة غيار' : 'إضافة قطعة غيار'}
                </h2>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">اسم القطعة *</label>
                  <input value={formName} onChange={e => setFormName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm" placeholder="مثال: فلتر زيت" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">رقم القطعة</label>
                    <input value={formPartNumber} onChange={e => setFormPartNumber(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">المورد</label>
                    <input value={formSupplier} onChange={e => setFormSupplier(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">السعر (د.ع)</label>
                    <input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">الكمية</label>
                    <input type="number" value={formQuantity} onChange={e => setFormQuantity(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">ملاحظات</label>
                  <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm resize-none" />
                </div>
              </div>
              <div className="px-5 py-4 border-t border-stone-200 dark:border-stone-800 flex gap-3">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-sm font-medium">إلغاء</button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={!formName.trim() || submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {submitting ? 'جاري الحفظ...' : 'حفظ'}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
