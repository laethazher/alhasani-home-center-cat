import { motion } from 'framer-motion';
import { Building2, LogOut, Moon, Shield, Sun, Truck, Wrench } from 'lucide-react';

interface SystemHomeProps {
  profileName: string;
  isDarkMode: boolean;
  isGateGuard?: boolean;
  onToggleDark: () => void;
  onSelectTajhiz: () => void;
  onSelectInstallation: () => void;
  onSelectGate?: () => void;
  onSignOut: () => void;
  signingOut?: boolean;
}

export default function SystemHome({
  profileName,
  isDarkMode,
  isGateGuard = false,
  onToggleDark,
  onSelectTajhiz,
  onSelectInstallation,
  onSelectGate,
  onSignOut,
  signingOut = false,
}: SystemHomeProps) {
  return (
    <div
      className="min-h-screen p-5 md:p-8"
      dir="rtl"
      style={{
        background: isDarkMode
          ? 'linear-gradient(150deg, #060a12 0%, #090f1d 60%, #070c16 100%)'
          : 'linear-gradient(150deg, #eef2ff 0%, #f8fafc 50%, #f0f9ff 100%)',
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-8">
          <div>
            <p className="text-sm font-semibold" style={{ color: isDarkMode ? '#64748b' : '#64748b' }}>
              أهلاً بك
            </p>
            <h1 className="text-2xl md:text-3xl font-black" style={{ color: isDarkMode ? '#f1f5f9' : '#0f172a' }}>
              الواجهة الرئيسية للسستم
            </h1>
            <p className="text-sm mt-1" style={{ color: isDarkMode ? '#475569' : '#94a3b8' }}>
              {profileName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleDark}
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: isDarkMode ? 'rgba(251,191,36,0.12)' : 'rgba(99,102,241,0.1)',
                border: isDarkMode ? '1px solid rgba(251,191,36,0.25)' : '1px solid rgba(99,102,241,0.2)',
              }}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>

            <button
              onClick={onSignOut}
              disabled={signingOut}
              className="h-10 px-3 rounded-xl flex items-center gap-2 text-sm font-bold"
              style={{
                background: isDarkMode ? 'rgba(239,68,68,0.12)' : 'rgba(220,38,38,0.08)',
                color: isDarkMode ? '#fca5a5' : '#dc2626',
                border: isDarkMode ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(220,38,38,0.2)',
              }}
            >
              <LogOut className="w-4 h-4" />
              تسجيل الخروج
            </button>
          </div>
        </div>

        <div className={`grid grid-cols-1 ${isGateGuard ? 'lg:grid-cols-1' : 'lg:grid-cols-2'} gap-5`}>
          {isGateGuard ? (
            <motion.button
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.99 }}
              onClick={onSelectGate}
              className="text-right rounded-2xl p-6 md:p-7 border"
              style={{
                background: isDarkMode ? 'rgba(15, 23, 31, 0.82)' : '#ffffff',
                borderColor: isDarkMode ? 'rgba(244,114,182,0.25)' : 'rgba(244,114,182,0.22)',
                boxShadow: isDarkMode ? '0 12px 30px rgba(2,6,23,0.5)' : '0 12px 28px rgba(15,23,42,0.08)',
              }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-pink-600/10 border border-pink-500/20">
                <Shield className="w-6 h-6 text-pink-500" />
              </div>
              <h2 className="text-xl font-black mb-2" style={{ color: isDarkMode ? '#e2e8f0' : '#0f172a' }}>
                بوابة الحارس الموحدة
              </h2>
              <p className="text-sm leading-7 mb-5" style={{ color: isDarkMode ? '#64748b' : '#64748b' }}>
                واجهة واحدة فقط تشمل طلبات قسم التجهيز وقسم التركيب مع تمييز واضح لمصدر كل طلب.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-pink-600 text-white">
                دخول بوابة الحارس
              </div>
            </motion.button>
          ) : (
            <>
          <motion.button
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.99 }}
            onClick={onSelectTajhiz}
            className="text-right rounded-2xl p-6 md:p-7 border"
            style={{
              background: isDarkMode ? 'rgba(14, 23, 41, 0.8)' : '#ffffff',
              borderColor: isDarkMode ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.2)',
              boxShadow: isDarkMode ? '0 12px 30px rgba(2,6,23,0.5)' : '0 12px 28px rgba(15,23,42,0.08)',
            }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-blue-600/10 border border-blue-500/20">
              <Truck className="w-6 h-6 text-blue-500" />
            </div>
            <h2 className="text-xl font-black mb-2" style={{ color: isDarkMode ? '#e2e8f0' : '#0f172a' }}>
              قسم التجهيز
            </h2>
            <p className="text-sm leading-7 mb-5" style={{ color: isDarkMode ? '#64748b' : '#64748b' }}>
              النظام الحالي الكامل كما هو، بكل المحتويات والواجهات والخصائص الموجودة حالياً.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white">
              دخول قسم التجهيز
            </div>
          </motion.button>

          <motion.button
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.99 }}
            onClick={onSelectInstallation}
            className="text-right rounded-2xl p-6 md:p-7 border"
            style={{
              background: isDarkMode ? 'rgba(15, 23, 31, 0.82)' : '#ffffff',
              borderColor: isDarkMode ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.22)',
              boxShadow: isDarkMode ? '0 12px 30px rgba(2,6,23,0.5)' : '0 12px 28px rgba(15,23,42,0.08)',
            }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-emerald-600/10 border border-emerald-500/20">
              <Wrench className="w-6 h-6 text-emerald-500" />
            </div>
            <h2 className="text-xl font-black mb-2" style={{ color: isDarkMode ? '#e2e8f0' : '#0f172a' }}>
              قسم التركيب
            </h2>
            <p className="text-sm leading-7 mb-5" style={{ color: isDarkMode ? '#64748b' : '#64748b' }}>
              واجهة القسم الجديد المخصص لإضافات التركيب، مع بنية بيانات مفصولة وجاهزة للتوسعة.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white">
              دخول قسم التركيب
            </div>
          </motion.button>
            </>
          )}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs" style={{ color: isDarkMode ? '#334155' : '#94a3b8' }}>
          <Building2 className="w-3.5 h-3.5" />
          <span>واجهة اختيار الأقسام</span>
        </div>
      </div>
    </div>
  );
}
