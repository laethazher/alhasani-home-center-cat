import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

interface DashboardCardProps {
  key?: React.Key;
  title: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  index?: number;
  onClick?: () => void;
}

const gradientColorMap: Record<string, { from: string; to: string; glow: string }> = {
  'from-blue-500 to-indigo-600':    { from: '#3b82f6', to: '#4f46e5', glow: 'rgba(79,70,229,0.3)' },
  'from-cyan-500 to-blue-600':      { from: '#06b6d4', to: '#2563eb', glow: 'rgba(6,182,212,0.3)' },
  'from-indigo-500 to-violet-600':  { from: '#6366f1', to: '#7c3aed', glow: 'rgba(124,58,237,0.3)' },
  'from-teal-500 to-emerald-600':   { from: '#14b8a6', to: '#059669', glow: 'rgba(20,184,166,0.3)' },
  'from-sky-500 to-blue-600':       { from: '#0ea5e9', to: '#2563eb', glow: 'rgba(14,165,233,0.3)' },
  'from-orange-500 to-amber-600':   { from: '#f97316', to: '#d97706', glow: 'rgba(249,115,22,0.3)' },
  'from-pink-500 to-rose-600':      { from: '#ec4899', to: '#e11d48', glow: 'rgba(236,72,153,0.3)' },
  'from-emerald-500 to-teal-600':   { from: '#10b981', to: '#0d9488', glow: 'rgba(16,185,129,0.3)' },
  'from-red-500 to-rose-600':       { from: '#ef4444', to: '#e11d48', glow: 'rgba(239,68,68,0.3)' },
  'from-amber-500 to-orange-600':   { from: '#f59e0b', to: '#ea580c', glow: 'rgba(245,158,11,0.3)' },
  'from-violet-500 to-purple-600':  { from: '#8b5cf6', to: '#9333ea', glow: 'rgba(139,92,246,0.3)' },
  'from-rose-500 to-pink-600':      { from: '#f43f5e', to: '#db2777', glow: 'rgba(244,63,94,0.3)' },
};

export default function DashboardCard({
  title,
  description,
  icon: Icon,
  gradient,
  index = 0,
  onClick,
}: DashboardCardProps) {
  const colors = gradientColorMap[gradient] ?? { from: '#3b82f6', to: '#4f46e5', glow: 'rgba(79,70,229,0.3)' };

  return (
    <motion.button
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.07, type: 'spring', stiffness: 280, damping: 24 }}
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-start gap-5 p-6 rounded-2xl text-right w-full',
        'bg-white dark:bg-stone-900',
        'border border-stone-100 dark:border-stone-800',
        'hover:border-transparent',
        'cursor-pointer overflow-hidden',
        'transition-all duration-300',
      )}
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 40px ${colors.glow}, 0 2px 8px rgba(0,0,0,0.06)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
      }}
    >
      {/* Hover background glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
        style={{ background: `radial-gradient(ellipse at top right, ${colors.glow} 0%, transparent 70%)` }}
      />

      {/* Top accent line */}
      <div
        className="absolute top-0 right-0 h-[3px] w-0 group-hover:w-full transition-all duration-500 rounded-tr-2xl rounded-tl-2xl"
        style={{ background: `linear-gradient(to left, ${colors.from}, ${colors.to})` }}
      />

      {/* Icon */}
      <div
        className="relative z-10 w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
          boxShadow: `0 6px 20px ${colors.glow}`,
        }}
      >
        <Icon className="w-7 h-7 text-white" />
      </div>

      {/* Text */}
      <div className="relative z-10 flex-1 text-right w-full">
        <h3 className="text-base font-bold mb-1.5 text-stone-900 dark:text-white">
          {title}
        </h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed line-clamp-2">
          {description}
        </p>
      </div>

      {/* Arrow on hover */}
      <div
        className="absolute left-5 bottom-5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0"
        style={{ color: colors.from }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </div>
    </motion.button>
  );
}
