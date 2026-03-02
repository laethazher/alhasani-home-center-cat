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

export default function DashboardCard({
  title,
  description,
  icon: Icon,
  gradient,
  index = 0,
  onClick,
}: DashboardCardProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, type: 'spring', stiffness: 260, damping: 20 }}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-center gap-4 p-8 rounded-2xl text-center',
        'bg-white dark:bg-stone-900 border border-stone-200/60 dark:border-stone-700/40',
        'shadow-sm hover:shadow-xl hover:shadow-stone-200/50 dark:hover:shadow-stone-900/50',
        'transition-shadow duration-300 cursor-pointer overflow-hidden',
      )}
    >
      {/* Gradient glow behind icon */}
      <div
        className={cn(
          'absolute -top-10 -right-10 w-36 h-36 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500',
          gradient,
        )}
      />

      {/* Icon container */}
      <div
        className={cn(
          'relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center',
          'bg-gradient-to-br shadow-lg',
          gradient,
        )}
      >
        <Icon className="w-8 h-8 text-white" />
      </div>

      {/* Text */}
      <div className="relative z-10">
        <h3 className="text-lg font-bold mb-1">{title}</h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Bottom accent line */}
      <div
        className={cn(
          'absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-0 group-hover:w-2/3 rounded-t-full transition-all duration-300',
          'bg-gradient-to-l',
          gradient,
        )}
      />
    </motion.button>
  );
}
