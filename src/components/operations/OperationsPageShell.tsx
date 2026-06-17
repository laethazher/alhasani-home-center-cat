import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface OperationsPageShellProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
}

export default function OperationsPageShell({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
}: OperationsPageShellProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10">
            <Icon className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white md:text-2xl">{title}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
