import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Eye, EyeOff, Truck, ArrowLeft, ShieldCheck, Mail, Lock } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
  if (msg.includes('Email not confirmed'))        return 'البريد الإلكتروني غير مفعّل بعد';
  if (msg.includes('Too many requests'))          return 'محاولات كثيرة، حاول لاحقاً';
  if (msg.includes('User not found'))             return 'المستخدم غير موجود';
  return msg;
}

function Background({ dark }: { dark: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0" style={{
        backgroundImage: dark
          ? `linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)`
          : `radial-gradient(circle, rgba(148,163,184,0.15) 1px, transparent 1px)`,
        backgroundSize: dark ? '52px 52px' : '30px 30px',
      }}/>
      {[
        { w:600, top:'-20%', right:'-15%', c: dark ? 'rgba(59,130,246,0.09)' : 'rgba(59,130,246,0.07)',  dur:8,  d:0 },
        { w:500, bottom:'-15%', left:'-10%', c: dark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.06)', dur:10, d:2 },
        { w:350, top:'38%', left:'22%',       c: dark ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.04)', dur:12, d:4 },
      ].map((o, i) => (
        <motion.div key={i}
          animate={{ scale:[1,1.1,1], opacity:[0.6,1,0.6] }}
          transition={{ duration:o.dur, repeat:Infinity, ease:'easeInOut', delay:o.d }}
          className="absolute rounded-full"
          style={{
            width:o.w, height:o.w,
            top:(o as any).top, right:(o as any).right,
            bottom:(o as any).bottom, left:(o as any).left,
            background:`radial-gradient(circle, ${o.c} 0%, transparent 70%)`,
            filter:'blur(48px)',
          }}
        />
      ))}
    </div>
  );
}

function Field({
  label, icon: Icon, type, value, onChange,
  placeholder, autoComplete, dark, suffix,
}: {
  label: string; icon: React.ElementType; type: string; value: string;
  onChange: (v: string) => void; placeholder: string;
  autoComplete: string; dark: boolean; suffix?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-black tracking-[0.12em] uppercase transition-colors duration-200"
        style={{ color: focused ? (dark ? '#818cf8' : '#3b82f6') : dark ? '#334155' : '#94a3b8' }}>
        {label}
      </label>
      <div className="relative">
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-300"
          style={{ color: focused ? (dark ? '#818cf8' : '#3b82f6') : dark ? '#1e293b' : '#d1d5db' }}>
          <Icon style={{ width:15, height:15 }}/>
        </div>
        <input
          type={type} required autoComplete={autoComplete}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder} dir="ltr"
          className="w-full pl-10 pr-11 py-3.5 rounded-xl text-sm outline-none transition-all duration-300"
          style={{
            background: focused
              ? dark ? 'rgba(99,102,241,0.07)' : 'rgba(59,130,246,0.04)'
              : dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
            border: focused
              ? `1.5px solid ${dark ? 'rgba(99,102,241,0.55)' : 'rgba(59,130,246,0.45)'}`
              : `1.5px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
            boxShadow: focused
              ? `0 0 0 4px ${dark ? 'rgba(99,102,241,0.1)' : 'rgba(59,130,246,0.08)'}`
              : 'none',
            color: dark ? '#f1f5f9' : '#0f172a',
            caretColor: dark ? '#818cf8' : '#3b82f6',
          }}
        />
        {suffix && <div className="absolute left-3.5 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [dark, setDark]         = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains('dark'))
    );
    obs.observe(document.documentElement, { attributes:true, attributeFilter:['class'] });
    return () => obs.disconnect();
  }, []);

  const canSubmit = !loading && !!email.trim() && !!password;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setError(''); setLoading(true);
    try {
      const { error: e } = await supabase.auth.signInWithPassword({ email:email.trim(), password });
      if (e) setError(translateError(e.message));
    } catch { setError('حدث خطأ غير متوقع'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative" dir="rtl"
      style={{ background: dark
        ? 'linear-gradient(145deg,#05080f 0%,#080d1a 60%,#060b16 100%)'
        : 'linear-gradient(145deg,#eef2ff 0%,#f8f7ff 50%,#f0fdf9 100%)' }}>

      <Background dark={dark}/>

      <motion.div
        initial={{ opacity:0, y:28, scale:0.96 }}
        animate={{ opacity:1, y:0, scale:1 }}
        transition={{ type:'spring', stiffness:260, damping:26 }}
        className="w-full max-w-[390px] relative z-10"
      >
        <div className="rounded-2xl overflow-hidden" style={{
          background: dark ? 'linear-gradient(160deg,#0e1521 0%,#0a1019 100%)' : '#ffffff',
          border: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)',
          boxShadow: dark
            ? '0 40px 80px rgba(0,0,0,0.7),inset 0 1px 0 rgba(255,255,255,0.05)'
            : '0 20px 60px rgba(0,0,0,0.09),0 4px 16px rgba(0,0,0,0.05)',
        }}>

          {/* Top bar */}
          <div style={{ height:3, background:'linear-gradient(90deg,#2563eb,#6366f1,#8b5cf6,#a855f7)' }}/>

          <div className="px-8 pt-8 pb-6 space-y-6">

            {/* Brand */}
            <div className="flex flex-col items-center gap-4 text-center">
              <motion.div
                whileHover={{ scale:1.07, rotate:4 }}
                transition={{ type:'spring', stiffness:360, damping:20 }}
                className="relative"
              >
                <div className="w-[58px] h-[58px] rounded-[18px] flex items-center justify-center" style={{
                  background:'linear-gradient(135deg,#2563eb,#4f46e5)',
                  boxShadow:'0 10px 30px rgba(79,70,229,0.55),inset 0 1px 0 rgba(255,255,255,0.2)',
                }}>
                  <Truck style={{ width:26, height:26, color:'#fff' }}/>
                </div>
                <div className="absolute -bottom-1.5 -left-1.5 w-[18px] h-[18px] rounded-full flex items-center justify-center"
                  style={{ background: dark ? '#0a1019' : '#fff', boxShadow: dark ? '0 0 0 1px rgba(255,255,255,0.07)' : '0 0 0 1.5px rgba(0,0,0,0.07)' }}>
                  <motion.div
                    animate={{ scale:[1,1.4,1] }}
                    transition={{ duration:2.5, repeat:Infinity, ease:'easeInOut' }}
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background:'#22c55e', boxShadow:'0 0 8px rgba(34,197,94,0.8)' }}
                  />
                </div>
              </motion.div>

              <div>
                <h1 className="text-xl font-black tracking-tight mb-1.5" style={{ color: dark ? '#f1f5f9' : '#0f172a' }}>
                  Alhasani Home Center Logistics
                </h1>
                <p className="text-[13px]" style={{ color: dark ? '#334155' : '#94a3b8' }}>
                  نظام إدارة المركبات والمعدات
                </p>
              </div>

              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full" style={{
                background: dark ? 'rgba(34,197,94,0.07)' : 'rgba(34,197,94,0.08)',
                border: `1px solid ${dark ? 'rgba(34,197,94,0.18)' : 'rgba(34,197,94,0.22)'}`,
              }}>
                <ShieldCheck style={{ width:12, height:12, color:'#22c55e' }}/>
                <span className="text-[11px] font-bold" style={{ color: dark ? '#4ade80' : '#15803d' }}>
                  اتصال آمن ومشفّر
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' }}/>
              <span className="text-[10px] font-black tracking-[0.14em] uppercase" style={{ color: dark ? '#1e293b' : '#cbd5e1' }}>
                بيانات الدخول
              </span>
              <div className="flex-1 h-px" style={{ background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' }}/>
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <Field
                label="البريد الإلكتروني" icon={Mail}
                type="email" value={email} onChange={setEmail}
                placeholder="name@company.com" autoComplete="email" dark={dark}
              />
              <Field
                label="كلمة المرور" icon={Lock}
                type={showPw ? 'text' : 'password'}
                value={password} onChange={setPassword}
                placeholder="••••••••" autoComplete="current-password" dark={dark}
                suffix={
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="transition-colors duration-200"
                    style={{ color: dark ? '#334155' : '#d1d5db' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = dark ? '#64748b' : '#9ca3af'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = dark ? '#334155' : '#d1d5db'}
                  >
                    {showPw ? <EyeOff style={{ width:15, height:15 }}/> : <Eye style={{ width:15, height:15 }}/>}
                  </button>
                }
              />

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
                    transition={{ duration:0.2 }}
                    className="flex items-start gap-2.5 px-4 py-3 rounded-xl"
                    style={{
                      background: dark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)',
                      border: `1px solid ${dark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.15)'}`,
                    }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background:'#ef4444' }}/>
                    <p className="text-[13px] font-semibold" style={{ color: dark ? '#fca5a5' : '#dc2626' }}>
                      {error}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Button */}
              <motion.button
                type="button" onClick={handleLogin} disabled={!canSubmit}
                whileHover={canSubmit ? { scale:1.012, y:-1 } : {}}
                whileTap={canSubmit ? { scale:0.985 } : {}}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-[14px] font-black relative overflow-hidden"
                style={{
                  background: canSubmit
                    ? 'linear-gradient(135deg,#2563eb 0%,#4f46e5 55%,#7c3aed 100%)'
                    : dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
                  boxShadow: canSubmit
                    ? '0 8px 28px rgba(79,70,229,0.4),0 2px 6px rgba(79,70,229,0.25),inset 0 1px 0 rgba(255,255,255,0.15)'
                    : 'none',
                  color: canSubmit ? '#fff' : dark ? '#1e293b' : '#cbd5e1',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s ease',
                }}
              >
                {canSubmit && !loading && (
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background:'linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.15) 50%,transparent 65%)',
                    backgroundSize:'250% 100%',
                    animation:'shimmer 3s infinite',
                  }}/>
                )}
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin z-10"/><span className="z-10">Logging in...</span></>
                  : <><span className="z-10">Login</span><ArrowLeft className="w-4 h-4 z-10"/></>
                }
              </motion.button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-2 py-4 px-8" style={{
            borderTop: dark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.05)',
          }}>
            <div className="w-1 h-1 rounded-full" style={{ background: dark ? '#1e293b' : '#e2e8f0' }}/>
            <p className="text-[11px]" style={{ color: dark ? '#1e293b' : '#e2e8f0' }}>
              Created by LaethAlkawaz &amp; Mohammed Ibrahim
            </p>
            <div className="w-1 h-1 rounded-full" style={{ background: dark ? '#1e293b' : '#e2e8f0' }}/>
          </div>
        </div>

        <motion.p
          initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.45 }}
          className="text-center mt-5 text-[11px]"
          style={{ color: dark ? '#1e293b' : '#cbd5e1' }}
        >
          Fleet Management System · v2.0
        </motion.p>
      </motion.div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position:200% center; }
          100% { background-position:-200% center; }
        }
      `}</style>
    </div>
  );
}