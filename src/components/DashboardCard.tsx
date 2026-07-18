import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface DashboardCardProps {
  key?: React.Key;
  title: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  index?: number;
  onClick?: () => void;
}

const PALETTE: Record<string, {
  from: string; to: string; mid: string;
  glowDark: string; glowLight: string;
  accent: string; accentSoft: string;
  textDark: string; textLight: string;
  borderDark: string; borderLight: string;
}> = {
  'from-blue-500 to-indigo-600':    { from:'#3b82f6',to:'#4f46e5',mid:'#6366f1', glowDark:'rgba(99,102,241,0.5)',  glowLight:'rgba(99,102,241,0.18)', accent:'#6366f1', accentSoft:'#e0e7ff', textDark:'#a5b4fc', textLight:'#4338ca', borderDark:'rgba(99,102,241,0.4)', borderLight:'rgba(99,102,241,0.25)' },
  'from-cyan-500 to-blue-600':      { from:'#06b6d4',to:'#2563eb',mid:'#0ea5e9', glowDark:'rgba(6,182,212,0.5)',   glowLight:'rgba(6,182,212,0.18)',  accent:'#0ea5e9', accentSoft:'#e0f2fe', textDark:'#67e8f9', textLight:'#0369a1', borderDark:'rgba(6,182,212,0.4)',  borderLight:'rgba(6,182,212,0.25)' },
  'from-indigo-500 to-violet-600':  { from:'#6366f1',to:'#7c3aed',mid:'#8b5cf6', glowDark:'rgba(139,92,246,0.5)', glowLight:'rgba(139,92,246,0.18)', accent:'#8b5cf6', accentSoft:'#ede9fe', textDark:'#c4b5fd', textLight:'#5b21b6', borderDark:'rgba(139,92,246,0.4)',borderLight:'rgba(139,92,246,0.25)' },
  'from-teal-500 to-emerald-600':   { from:'#14b8a6',to:'#059669',mid:'#10b981', glowDark:'rgba(16,185,129,0.5)', glowLight:'rgba(16,185,129,0.18)', accent:'#10b981', accentSoft:'#d1fae5', textDark:'#6ee7b7', textLight:'#065f46', borderDark:'rgba(16,185,129,0.4)',borderLight:'rgba(16,185,129,0.25)' },
  'from-sky-500 to-blue-600':       { from:'#0ea5e9',to:'#2563eb',mid:'#38bdf8', glowDark:'rgba(56,189,248,0.5)', glowLight:'rgba(56,189,248,0.18)', accent:'#38bdf8', accentSoft:'#e0f2fe', textDark:'#7dd3fc', textLight:'#075985', borderDark:'rgba(56,189,248,0.4)', borderLight:'rgba(56,189,248,0.25)' },
  'from-orange-500 to-amber-600':   { from:'#f97316',to:'#d97706',mid:'#fb923c', glowDark:'rgba(251,146,60,0.5)',  glowLight:'rgba(251,146,60,0.18)',  accent:'#fb923c', accentSoft:'#ffedd5', textDark:'#fdba74', textLight:'#c2410c', borderDark:'rgba(251,146,60,0.4)', borderLight:'rgba(251,146,60,0.25)' },
  'from-pink-500 to-rose-600':      { from:'#ec4899',to:'#e11d48',mid:'#f472b6', glowDark:'rgba(244,114,182,0.5)',glowLight:'rgba(244,114,182,0.18)',accent:'#f472b6', accentSoft:'#fce7f3', textDark:'#f9a8d4', textLight:'#9d174d', borderDark:'rgba(244,114,182,0.4)',borderLight:'rgba(244,114,182,0.25)' },
  'from-emerald-500 to-teal-600':   { from:'#10b981',to:'#0d9488',mid:'#34d399', glowDark:'rgba(52,211,153,0.5)', glowLight:'rgba(52,211,153,0.18)', accent:'#34d399', accentSoft:'#d1fae5', textDark:'#6ee7b7', textLight:'#065f46', borderDark:'rgba(52,211,153,0.4)', borderLight:'rgba(52,211,153,0.25)' },
  'from-red-500 to-rose-600':       { from:'#ef4444',to:'#e11d48',mid:'#f87171', glowDark:'rgba(248,113,113,0.5)',glowLight:'rgba(248,113,113,0.18)',accent:'#f87171', accentSoft:'#fee2e2', textDark:'#fca5a5', textLight:'#991b1b', borderDark:'rgba(248,113,113,0.4)',borderLight:'rgba(248,113,113,0.25)' },
  'from-amber-500 to-orange-600':   { from:'#f59e0b',to:'#ea580c',mid:'#fbbf24', glowDark:'rgba(251,191,36,0.5)', glowLight:'rgba(251,191,36,0.18)', accent:'#fbbf24', accentSoft:'#fef3c7', textDark:'#fde68a', textLight:'#92400e', borderDark:'rgba(251,191,36,0.4)', borderLight:'rgba(251,191,36,0.25)' },
  'from-violet-500 to-purple-600':  { from:'#8b5cf6',to:'#9333ea',mid:'#a78bfa', glowDark:'rgba(167,139,250,0.5)',glowLight:'rgba(167,139,250,0.18)',accent:'#a78bfa', accentSoft:'#ede9fe', textDark:'#ddd6fe', textLight:'#5b21b6', borderDark:'rgba(167,139,250,0.4)',borderLight:'rgba(167,139,250,0.25)' },
  'from-rose-500 to-pink-600':      { from:'#f43f5e',to:'#db2777',mid:'#fb7185', glowDark:'rgba(251,113,133,0.5)',glowLight:'rgba(251,113,133,0.18)',accent:'#fb7185', accentSoft:'#ffe4e6', textDark:'#fda4af', textLight:'#9f1239', borderDark:'rgba(251,113,133,0.4)',borderLight:'rgba(251,113,133,0.25)' },
};

export default function DashboardCard({
  title, description, icon: Icon, gradient, index = 0, onClick,
}: DashboardCardProps) {
  const [hovered, setHovered] = useState(false);
  const p = PALETTE[gradient] ?? PALETTE['from-blue-500 to-indigo-600'];

  const sharedMotion = {
    initial: { opacity: 0, y: 36, scale: 0.93 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { delay: index * 0.055, type: 'spring' as const, stiffness: 250, damping: 24 },
    whileHover: { y: -9, scale: 1.035 },
    whileTap: { scale: 0.96 },
  };

  /* ── DARK CARD ── */
  const darkCard = (
    <motion.button
      {...sharedMotion}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col p-0 rounded-2xl w-full cursor-pointer overflow-hidden text-right"
      style={{
        background: hovered ? 'linear-gradient(145deg,#1c2133,#111827)' : 'linear-gradient(145deg,#151c2c,#0d1117)',
        border: `1px solid ${hovered ? p.borderDark : 'rgba(255,255,255,0.055)'}`,
        boxShadow: hovered
          ? `0 28px 70px ${p.glowDark}, 0 0 0 1px ${p.accent}22, inset 0 1px 0 rgba(255,255,255,0.09)`
          : '0 2px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.035)',
        transition: 'all 0.45s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* Mesh glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        opacity: hovered ? 1 : 0,
        background: `radial-gradient(ellipse at 10% 10%, ${p.glowDark.replace('0.5','0.13')} 0%, transparent 60%),
                     radial-gradient(ellipse at 90% 90%, ${p.glowDark.replace('0.5','0.10')} 0%, transparent 60%)`,
        transition: 'opacity 0.5s ease',
      }}/>

      {/* Shimmer top border */}
      <div className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none" style={{
        background: `linear-gradient(90deg, transparent, ${p.from} 25%, ${p.mid} 50%, ${p.to} 75%, transparent)`,
        opacity: hovered ? 1 : 0,
        transform: hovered ? 'scaleX(1)' : 'scaleX(0)',
        transformOrigin: 'center',
        transition: 'all 0.55s cubic-bezier(0.22,1,0.36,1)',
      }}/>

      {/* Noise */}
      <div className="absolute inset-0 opacity-[0.022] pointer-events-none mix-blend-screen" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}/>

      <div className="relative z-10 flex flex-col gap-5 p-6 w-full">
        {/* Icon + dot */}
        <div className="flex items-start justify-between w-full">
          <div className="relative flex items-center justify-center flex-shrink-0 rounded-xl" style={{
            width:54, height:54,
            background: `linear-gradient(135deg,${p.from}22,${p.to}11)`,
            border: `1px solid ${p.accent}28`,
            boxShadow: hovered ? `0 0 30px ${p.glowDark}, inset 0 1px 0 ${p.accent}18` : 'none',
            transition: 'all 0.45s ease',
          }}>
            <div className="absolute inset-0 rounded-xl blur-xl pointer-events-none" style={{
              background: `radial-gradient(circle,${p.from}30,transparent 70%)`,
              opacity: hovered ? 1 : 0.35,
              transition: 'opacity 0.4s ease',
            }}/>
            <Icon className="relative z-10 w-6 h-6" style={{
              color: hovered ? p.accent : p.textDark,
              filter: hovered ? `drop-shadow(0 0 10px ${p.accent}) drop-shadow(0 0 20px ${p.accent}80)` : 'none',
              transition: 'all 0.35s ease',
            }}/>
          </div>

          <div className="relative mt-2 flex-shrink-0">
            <div className="w-2 h-2 rounded-full" style={{
              background: p.accent,
              boxShadow: hovered ? `0 0 12px ${p.accent},0 0 24px ${p.glowDark}` : 'none',
              opacity: hovered ? 1 : 0.2,
              transition: 'all 0.4s ease',
            }}/>
            {hovered && (
              <div className="absolute inset-0 rounded-full animate-ping" style={{ background: p.accent, opacity: 0.4 }}/>
            )}
          </div>
        </div>

        {/* Text */}
        <div className="flex flex-col gap-2 w-full">
          <h3 className="text-[15px] font-bold tracking-tight leading-snug text-right" style={{
            color: hovered ? '#f8fafc' : '#cbd5e1',
            textShadow: hovered ? `0 0 28px ${p.accent}55` : 'none',
            transition: 'all 0.3s ease',
          }}>{title}</h3>
          <p className="text-[13px] leading-relaxed line-clamp-2 text-right" style={{
            color: hovered ? '#64748b' : '#3f4f64',
            transition: 'color 0.3s ease',
          }}>{description}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between w-full pt-1 border-t border-white/[0.04]">
          <div className="flex items-center gap-2" style={{
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateX(0)' : 'translateX(12px)',
            transition: 'all 0.38s cubic-bezier(0.22,1,0.36,1)',
          }}>
            <span className="text-[11px] font-black tracking-[0.14em] uppercase" style={{ color: p.textDark }}>فتح القسم</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={p.accent} strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>
          <div className="h-px" style={{
            width: hovered ? '42%' : '12%',
            background: `linear-gradient(to left,transparent,${p.accent}55)`,
            transition: 'width 0.55s cubic-bezier(0.22,1,0.36,1)',
          }}/>
        </div>
      </div>

      {/* Corner blob */}
      <div className="absolute -bottom-6 -left-6 rounded-full pointer-events-none" style={{
        width: hovered ? 110 : 55, height: hovered ? 110 : 55,
        background: `radial-gradient(circle,${p.glowDark},transparent 70%)`,
        opacity: hovered ? 0.65 : 0.12,
        filter: 'blur(18px)',
        transition: 'all 0.55s ease',
      }}/>
    </motion.button>
  );

  /* ── LIGHT CARD ── */
  const lightCard = (
    <motion.button
      {...sharedMotion}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col p-0 rounded-2xl w-full cursor-pointer overflow-hidden text-right"
      style={{
        background: hovered
          ? `linear-gradient(145deg,#ffffff,${p.accentSoft}60)`
          : 'linear-gradient(145deg,#ffffff,#f8fafc)',
        border: `1px solid ${hovered ? p.borderLight : 'rgba(0,0,0,0.065)'}`,
        boxShadow: hovered
          ? `0 20px 60px ${p.glowLight},0 4px 16px rgba(0,0,0,0.08),inset 0 1px 0 rgba(255,255,255,0.9)`
          : '0 2px 12px rgba(0,0,0,0.06),0 1px 3px rgba(0,0,0,0.04),inset 0 1px 0 #fff',
        transition: 'all 0.45s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* Color wash */}
      <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{
        opacity: hovered ? 1 : 0,
        background: `radial-gradient(ellipse at 0% 0%,${p.glowLight} 0%,transparent 65%)`,
        transition: 'opacity 0.5s ease',
      }}/>

      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none rounded-t-2xl" style={{
        background: `linear-gradient(90deg,${p.from},${p.mid},${p.to})`,
        opacity: hovered ? 1 : 0,
        transform: hovered ? 'scaleX(1)' : 'scaleX(0)',
        transformOrigin: 'center',
        transition: 'all 0.5s cubic-bezier(0.22,1,0.36,1)',
      }}/>

      <div className="relative z-10 flex flex-col gap-5 p-6 w-full">
        {/* Icon + dot */}
        <div className="flex items-start justify-between w-full">
          <div className="relative flex items-center justify-center flex-shrink-0 rounded-xl" style={{
            width:54, height:54,
            background: hovered
              ? `linear-gradient(135deg,${p.from},${p.to})`
              : `linear-gradient(135deg,${p.accentSoft},${p.accentSoft}cc)`,
            border: `1px solid ${hovered ? 'transparent' : p.borderLight}`,
            boxShadow: hovered
              ? `0 8px 28px ${p.glowLight},0 2px 8px ${p.glowDark.replace('0.5','0.3')}`
              : `0 2px 8px ${p.glowLight}`,
            transition: 'all 0.4s ease',
          }}>
            <Icon className="relative z-10 w-6 h-6" style={{
              color: hovered ? '#ffffff' : p.textLight,
              filter: hovered ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none',
              transition: 'all 0.35s ease',
            }}/>
          </div>
          <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{
            background: hovered ? p.accent : `${p.accent}55`,
            boxShadow: hovered ? `0 0 12px ${p.glowLight}` : 'none',
            transition: 'all 0.4s ease',
          }}/>
        </div>

        {/* Text */}
        <div className="flex flex-col gap-1.5 w-full">
          <h3 className="text-[15px] font-bold tracking-tight leading-snug text-right" style={{
            color: hovered ? '#0f172a' : '#1e293b',
            transition: 'color 0.3s ease',
          }}>{title}</h3>
          <p className="text-[13px] leading-relaxed line-clamp-2 text-right" style={{
            color: hovered ? '#475569' : '#64748b',
            transition: 'color 0.3s ease',
          }}>{description}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between w-full pt-2" style={{
          borderTop: `1px solid ${hovered ? p.borderLight : 'rgba(0,0,0,0.05)'}`,
          transition: 'border-color 0.3s ease',
        }}>
          <div className="flex items-center gap-2" style={{
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateX(0)' : 'translateX(10px)',
            transition: 'all 0.38s cubic-bezier(0.22,1,0.36,1)',
          }}>
            <span className="text-[11px] font-black tracking-[0.12em] uppercase" style={{ color: p.textLight }}>فتح القسم</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={p.accent} strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>
          <div className="h-px" style={{
            width: hovered ? '42%' : '12%',
            background: `linear-gradient(to left,transparent,${p.accent}60)`,
            transition: 'width 0.55s cubic-bezier(0.22,1,0.36,1)',
          }}/>
        </div>
      </div>
    </motion.button>
  );

  return (
    <>
      <span className="hidden dark:inline w-full">{darkCard}</span>
      <span className="dark:hidden w-full">{lightCard}</span>
    </>
  );
}