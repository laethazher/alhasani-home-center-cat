import { Loader2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

export interface BulkDeleteSelectedButtonProps {
  selectedCount: number;
  deleting?: boolean;
  disabled?: boolean;
  confirmMessage: (count: number) => string;
  onDelete: () => void | Promise<void>;
  className?: string;
  /** افتراضي: حذف المحدد (n) */
  label?: (count: number) => string;
}

/**
 * زر موحّد لحذف الصفوف المحددة — يظهر فقط عندما يكون هناك عنصر واحد على الأقل.
 * يطلب التأكيد عبر window.confirm ثم ينفّذ onDelete.
 */
export function BulkDeleteSelectedButton({
  selectedCount,
  deleting = false,
  disabled = false,
  confirmMessage,
  onDelete,
  className,
  label = (n) => `حذف المحدد (${n})`,
}: BulkDeleteSelectedButtonProps) {
  if (selectedCount <= 0) return null;

  const run = async () => {
    if (!window.confirm(confirmMessage(selectedCount))) return;
    await onDelete();
  };

  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={disabled || deleting}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-colors',
        'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none',
        className
      )}
    >
      {deleting ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Trash2 className="w-4 h-4 shrink-0" />}
      {label(selectedCount)}
    </button>
  );
}
