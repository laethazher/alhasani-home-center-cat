import React, { useState } from 'react';
import { Bookmark, Trash2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { PageKey } from '../types';
import type { SavedViewRecord } from '../types';
import { useSavedViews } from '../hooks/useSavedViews';

interface SavedViewsProps<T extends Record<string, unknown>> {
  pageKey: PageKey;
  /** فصل التخزين بين الأقسام (مثل tajhiz / installation) */
  storageScope?: string;
  /** لقطة الحالة الحالية للحفظ */
  getCurrentPayload: () => T;
  /** تطبيق عند اختيار عرض */
  onApply: (payload: T) => void;
  className?: string;
}

export function SavedViews<T extends Record<string, unknown>>({
  pageKey,
  storageScope,
  getCurrentPayload,
  onApply,
  className,
}: SavedViewsProps<T>) {
  const { views, saveView, deleteView } = useSavedViews<T>(pageKey, storageScope);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [showSave, setShowSave] = useState(false);

  const handleSave = () => {
    const payload = getCurrentPayload();
    saveView(name, payload);
    setName('');
    setShowSave(false);
  };

  return (
    <div className={cn('relative flex flex-wrap items-center gap-2', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border',
          'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40',
          'text-violet-900 dark:text-violet-100 hover:bg-violet-100 dark:hover:bg-violet-900/50'
        )}
      >
        <Bookmark className="w-4 h-4" />
        العروض المحفوظة
        <ChevronDown className={cn('w-4 h-4', open && 'rotate-180')} />
      </button>
      <button
        type="button"
        onClick={() => setShowSave((s) => !s)}
        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
      >
        + حفظ العرض الحالي
      </button>

      {showSave && (
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم العرض (مثلاً: تقارير المتأخرين)"
            className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm"
          />
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
          >
            حفظ
          </button>
        </div>
      )}

      <AnimatePresence>
        {open && views.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full right-0 z-50 mt-1 w-72 max-h-64 overflow-y-auto rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 shadow-xl"
          >
            {views.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-2 px-3 py-2 border-b border-stone-100 dark:border-stone-800 last:border-0"
              >
                <button
                  type="button"
                  className="flex-1 text-right text-sm font-medium text-stone-800 dark:text-stone-100 hover:text-blue-600"
                  onClick={() => {
                    onApply(v.payload as T);
                    setOpen(false);
                  }}
                >
                  {v.name}
                </button>
                <button
                  type="button"
                  className="p-1 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  onClick={() => deleteView(v.id)}
                  title="حذف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
