import { motion } from 'framer-motion';
import { DoorOpen } from 'lucide-react';

export default function StaffExit() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">إخراج الكادر</h2>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
          <DoorOpen className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-bold mb-1">لا توجد سجلات بعد</h3>
        <p className="text-stone-500 dark:text-stone-400 text-sm max-w-xs">
          سيتم عرض سجلات إخراج الكادر هنا
        </p>
      </div>
    </div>
  );
}
