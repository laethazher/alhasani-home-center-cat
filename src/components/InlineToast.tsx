import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';

type ToastKind = 'success' | 'error';

export interface InlineToastProps {
  open: boolean;
  message: string;
  kind?: ToastKind;
  durationMs?: number;
  onClose: () => void;
}

export function InlineToast({
  open,
  message,
  kind = 'success',
  durationMs = 4800,
  onClose,
}: InlineToastProps) {
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => onClose(), durationMs);
    return () => window.clearTimeout(t);
  }, [open, durationMs, onClose]);

  return (
    <AnimatePresence>
      {open && message ? (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          className={cn(
            'fixed top-4 left-1/2 z-[220] flex w-[min(92vw,28rem)] -translate-x-1/2 items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-sm',
            kind === 'success'
              ? 'border-emerald-200/90 bg-emerald-50/95 text-emerald-950 dark:border-emerald-800/80 dark:bg-emerald-950/90 dark:text-emerald-50'
              : 'border-red-200/90 bg-red-50/95 text-red-950 dark:border-red-800/80 dark:bg-red-950/90 dark:text-red-50',
          )}
        >
          <div
            className={cn(
              'mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl',
              kind === 'success'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                : 'bg-red-500/15 text-red-600 dark:text-red-300',
            )}
          >
            {kind === 'success' ? (
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            ) : (
              <AlertCircle className="h-5 w-5" aria-hidden />
            )}
          </div>
          <p className="flex-1 pt-1 text-sm font-semibold leading-relaxed text-right">{message}</p>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'rounded-lg p-1.5 transition-colors',
              kind === 'success'
                ? 'text-emerald-700/70 hover:bg-emerald-500/10 hover:text-emerald-900 dark:text-emerald-200/70 dark:hover:bg-emerald-500/15'
                : 'text-red-700/70 hover:bg-red-500/10 hover:text-red-900 dark:text-red-200/70 dark:hover:bg-red-500/15',
            )}
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
