import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, LogIn, Eye, EyeOff, Truck } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPw, setShowPw]     = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(translateError(authError.message));
      }
    } catch {
      setError('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-100 via-white to-blue-50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 p-4" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="w-full max-w-md"
      >
        <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl shadow-stone-200/40 dark:shadow-stone-950/60 border border-stone-200/60 dark:border-stone-700/40 p-10 space-y-8">
          {/* Brand */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Truck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold">الحسني هوم سنتر</h1>
            <p className="text-sm text-stone-500 dark:text-stone-400">نظام إدارة المركبات والمعدات</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700 dark:text-stone-300">البريد الإلكتروني</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm transition-all"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700 dark:text-stone-300">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm transition-all"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl text-center font-medium"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-blue-600/30 hover:shadow-xl disabled:opacity-60 transition-shadow"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
              {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Translate common Supabase auth errors ── */
function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials'))   return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
  if (msg.includes('Email not confirmed'))          return 'البريد الإلكتروني غير مفعّل بعد';
  if (msg.includes('Too many requests'))            return 'محاولات كثيرة، حاول لاحقاً';
  if (msg.includes('User not found'))               return 'المستخدم غير موجود';
  return msg;
}
