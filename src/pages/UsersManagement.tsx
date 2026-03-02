import { motion } from 'framer-motion';
import { UserCog, Plus, Shield, Mail } from 'lucide-react';

export default function UsersManagement() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">إدارة المستخدمين</h2>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium shadow-lg shadow-violet-600/25 hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          إضافة مستخدم
        </motion.button>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-4">
          <UserCog className="w-10 h-10 text-violet-600 dark:text-violet-400" />
        </div>
        <h3 className="text-lg font-bold mb-1">إدارة المستخدمين</h3>
        <p className="text-stone-500 dark:text-stone-400 text-sm max-w-xs">
          قم بإدارة حسابات المستخدمين وتعيين الأدوار والصلاحيات
        </p>
      </div>
    </div>
  );
}
