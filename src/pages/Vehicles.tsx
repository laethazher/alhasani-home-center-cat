import { motion } from 'framer-motion';
import { Truck, Plus } from 'lucide-react';

export default function Vehicles() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">جرد المركبات</h2>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          إضافة مركبة
        </motion.button>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
          <Truck className="w-10 h-10 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-bold mb-1">لا توجد مركبات بعد</h3>
        <p className="text-stone-500 dark:text-stone-400 text-sm max-w-xs">
          ابدأ بإضافة المركبات لتتمكن من إدارة جردها ومتابعة حالتها
        </p>
      </div>
    </div>
  );
}
