import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Search, Package, Edit2, Trash2, AlertTriangle,
  Save, Loader2, Hash, Building2, DollarSign, Layers,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import type { SparePart, SparePartUsage } from '../lib/supabaseClient';

const LOW_STOCK_THRESHOLD = 5;

export default function SpareParts() {
  const [parts, setParts] = useState<SparePart[]>([]);
  const [usage, setUsage] = useState<SparePartUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

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
      supabase.from('spare_parts').select('*').order('name'),
      supabase.from('spare_part_usage').select('*'),
    ]);
    if (partsRes.data) setParts(partsRes.data);
    if (usageRes.data) setUsage(usageRes.data);
    setLoading(false);
  }, []);

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
      await supabase.from('spare_parts').update(data).eq('id', editingPart.id);
    } else {
      await supabase.from('spare_parts').insert(data);
    }
    setSubmitting(false);
    setShowForm(false);
    fetchData();
  }

  async function handleDelete(id: number) {
    await supabase.from('spare_parts').delete().eq('id', id);
    setDeleteConfirm(null);
    fetchData();
  }

  const totalValue = useMemo(() => parts.reduce((s, p) => s + p.price * p.quantity, 0), [parts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={openNewForm}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium shadow-lg shadow-blue-600/30"
        >
          <Plus className="w-4 h-4" /> إضافة قطعة غيار
        </motion.button>
      </div>

      {/* Parts table */}
      <div className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50">
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
                <tr key={part.id} className="border-b border-stone-100 dark:border-stone-800/50 hover:bg-stone-50 dark:hover:bg-stone-800/30 transition-colors">
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
                      {deleteConfirm === part.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleDelete(part.id)} className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-500">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(part.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
