import React, { useState } from 'react';
import { Download, ChevronDown, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { ExportMetadata } from '../utils/exportUtils';
import { exportFilteredCsv, exportFilteredExcel, exportFilteredPdf } from '../utils/exportUtils';

interface ExportMenuProps {
  meta: ExportMetadata;
  headerRow: unknown[];
  dataRows: unknown[][];
  sheetName?: string;
  disabled?: boolean;
  className?: string;
}

export function ExportMenu({
  meta,
  headerRow,
  dataRows,
  sheetName = 'تصدير',
  disabled,
  className,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'csv' | 'excel' | 'pdf' | null>(null);

  const strHeaders = headerRow.map((h) => String(h));
  const strRows = dataRows.map((row) => row.map((c) => String(c ?? '')));

  const run = async (kind: 'csv' | 'excel' | 'pdf') => {
    if (disabled || dataRows.length === 0) return;
    setBusy(kind);
    try {
      if (kind === 'csv') exportFilteredCsv(meta, headerRow, dataRows);
      else if (kind === 'excel') exportFilteredExcel(meta, headerRow, dataRows, sheetName);
      else await exportFilteredPdf(meta, strHeaders, strRows);
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled || dataRows.length === 0}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors',
          'border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800',
          'hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-100',
          'disabled:opacity-50 disabled:pointer-events-none'
        )}
      >
        <Download className="w-4 h-4" />
        تصدير ذكي
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute end-0 z-50 mt-1 min-w-[200px] rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 shadow-xl overflow-hidden"
          >
            <button
              type="button"
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-right hover:bg-stone-50 dark:hover:bg-stone-800"
              onClick={() => run('csv')}
              disabled={!!busy}
            >
              <FileText className="w-4 h-4 shrink-0" />
              CSV (مع بيانات التصدير)
              {busy === 'csv' && '…'}
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-right hover:bg-stone-50 dark:hover:bg-stone-800 border-t border-stone-100 dark:border-stone-800"
              onClick={() => run('excel')}
              disabled={!!busy}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              Excel
              {busy === 'excel' && '…'}
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-right hover:bg-stone-50 dark:hover:bg-stone-800 border-t border-stone-100 dark:border-stone-800"
              onClick={() => run('pdf')}
              disabled={!!busy}
            >
              <Printer className="w-4 h-4 shrink-0" />
              PDF
              {busy === 'pdf' && '…'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
