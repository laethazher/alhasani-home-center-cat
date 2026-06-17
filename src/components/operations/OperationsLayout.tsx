import { useState, type ElementType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, ArrowRight, LogOut, Menu, Moon, Sun, X,
  ClipboardList, MapPin, Calendar, AlertTriangle, Package,
  BarChart3, Plug, FileText, LayoutDashboard,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { UserProfile } from '../../lib/supabaseClient';
import { OPERATIONS_NAV, type OperationsPageKey } from '../../pages/operations/types';
import { Button } from '../ui/button';

const PAGE_ICONS: Record<OperationsPageKey, ElementType> = {
  'ops-dashboard': LayoutDashboard,
  'ops-tasks': ClipboardList,
  'ops-field': MapPin,
  'ops-scheduling': Calendar,
  'ops-incidents': AlertTriangle,
  'ops-inventory': Package,
  'ops-analytics': BarChart3,
  'ops-integrations': Plug,
  'shared-reports': FileText,
};

const ACCENT = '#06b6d4';

interface OperationsLayoutProps {
  children: React.ReactNode;
  profile: UserProfile;
  activePage: OperationsPageKey;
  onNavigate: (page: OperationsPageKey) => void;
  onBackToSections?: () => void;
  onSignOut: () => void;
  signingOut?: boolean;
  isDarkMode: boolean;
  onToggleDark: () => void;
}

export default function OperationsLayout({
  children,
  profile,
  activePage,
  onNavigate,
  onBackToSections,
  onSignOut,
  signingOut = false,
  isDarkMode,
  onToggleDark,
}: OperationsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const coreNav = OPERATIONS_NAV.filter((n) => n.section === 'core');
  const sharedNav = OPERATIONS_NAV.filter((n) => n.section === 'shared');
  const currentLabel = OPERATIONS_NAV.find((n) => n.key === activePage)?.label ?? 'قسم العمليات';

  function NavButton({ pageKey, label, mobile }: { pageKey: OperationsPageKey; label: string; mobile?: boolean }) {
    const Icon = PAGE_ICONS[pageKey];
    const active = activePage === pageKey;
    const show = sidebarOpen || mobile;

    return (
      <button
        type="button"
        onClick={() => {
          onNavigate(pageKey);
          if (mobile) setMobileOpen(false);
        }}
        className={cn(
          'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
          active && 'shadow-sm',
        )}
        style={{
          background: active ? (isDarkMode ? `${ACCENT}18` : `${ACCENT}12`) : 'transparent',
          border: `1px solid ${active ? `${ACCENT}35` : 'transparent'}`,
          color: active ? (isDarkMode ? '#e0f2fe' : '#0e7490') : isDarkMode ? '#64748b' : '#64748b',
        }}
      >
        <Icon className="h-4 w-4 shrink-0" style={{ color: active ? ACCENT : undefined }} />
        {show ? <span className="flex-1 truncate text-right">{label}</span> : null}
      </button>
    );
  }

  function SidebarContent({ mobile = false }: { mobile?: boolean }) {
    const show = sidebarOpen || mobile;

    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b border-[hsl(var(--border))] px-4 py-5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg,#0891b2,#0284c7)', boxShadow: '0 4px 16px rgba(6,182,212,0.35)' }}
          >
            <Activity className="h-[18px] w-[18px] text-white" />
          </div>
          {show ? (
            <div>
              <p className="text-sm font-black leading-tight" style={{ color: isDarkMode ? '#f1f5f9' : '#0f172a' }}>
                قسم العمليات
              </p>
              <p className="text-[10px] font-semibold" style={{ color: isDarkMode ? '#334155' : '#94a3b8' }}>
                Operations Control
              </p>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3" style={{ scrollbarWidth: 'none' }}>
          {show ? (
            <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: isDarkMode ? '#1e293b' : '#cbd5e1' }}>
              وحدات العمليات
            </p>
          ) : null}
          {coreNav.map((item) => (
            <NavButton key={item.key} pageKey={item.key} label={item.label} mobile={mobile} />
          ))}

          <div className="mx-1 my-3 h-px bg-[hsl(var(--border))]/60" />

          {show ? (
            <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: isDarkMode ? '#1e293b' : '#cbd5e1' }}>
              خدمات مشتركة
            </p>
          ) : null}
          {sharedNav.map((item) => (
            <NavButton key={item.key} pageKey={item.key} label={item.label} mobile={mobile} />
          ))}
        </nav>

        <div className="shrink-0 border-t border-[hsl(var(--border))] px-2.5 pb-4 pt-3">
          <div
            className={cn('mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5', !show && 'justify-center')}
            style={{
              background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)',
            }}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#0284c7)' }}
            >
              {profile.full_name.charAt(0)}
            </div>
            {show ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-right text-sm font-bold" style={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
                  {profile.full_name}
                </p>
                <p className="text-right text-[10px] font-semibold text-cyan-600 dark:text-cyan-400">مدير النظام</p>
              </div>
            ) : null}
          </div>

          {onBackToSections ? (
            <Button variant="outline" className="mb-1.5 w-full justify-center font-bold" onClick={onBackToSections}>
              <ArrowRight className="h-4 w-4" />
              {show ? 'رجوع للأقسام' : null}
            </Button>
          ) : null}
          <Button variant="destructive" className="w-full justify-center font-bold" onClick={onSignOut} disabled={signingOut}>
            <LogOut className="h-4 w-4" />
            {show ? 'تسجيل الخروج' : null}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: isDarkMode
          ? 'radial-gradient(900px 480px at 10% 8%, rgba(8,145,178,0.12), transparent 50%), #0a0f14'
          : 'radial-gradient(900px 480px at 10% 8%, rgba(6,182,212,0.10), transparent 50%), #f8fafc',
      }}
      dir="rtl"
    >
      <div className="flex min-h-screen">
        <aside
          className={cn(
            'hidden shrink-0 border-l border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 backdrop-blur-xl transition-all duration-300 md:flex md:flex-col',
            sidebarOpen ? 'w-64' : 'w-[72px]',
          )}
        >
          <SidebarContent />
        </aside>

        <AnimatePresence>
          {mobileOpen ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/50 md:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                className="fixed inset-y-0 right-0 z-50 w-72 border-l border-[hsl(var(--border))] bg-[hsl(var(--background))] md:hidden"
              >
                <button
                  type="button"
                  className="absolute left-3 top-3 rounded-lg p-2"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
                <SidebarContent mobile />
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 px-4 py-3 backdrop-blur-xl md:px-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg p-2 md:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="hidden rounded-lg p-2 md:block"
                onClick={() => setSidebarOpen((v) => !v)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <p className="text-[10px] font-black tracking-[0.2em] text-cyan-700 dark:text-cyan-300">OPERATIONS</p>
                <h1 className="text-lg font-black text-slate-900 dark:text-white">{currentLabel}</h1>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onToggleDark} className="font-bold">
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </header>

          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
