import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Truck,
  FileText,
  UserCog,
  Settings,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  UserCircle,
  DoorOpen,
  Shield,
  Wrench,
  ClipboardList,
  Activity,
  History,
  Package,
  Bell,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import type { UserProfile, UserRole } from '../lib/supabaseClient';

/* ── Types ── */

export type PageKey =
  | 'dashboard'
  | 'vehicles'
  | 'reports'
  | 'staff-exit'
  | 'violations'
  | 'users'
  | 'settings'
  | 'maintenance'
  | 'maintenance-requests'
  | 'active-maintenance'
  | 'maintenance-history'
  | 'spare-parts'
  | 'notifications';

interface NavItem {
  key: PageKey;
  label: string;
  icon: React.ElementType;
  roles: UserRole[] | 'all';
}

interface MaintenanceChild {
  key: PageKey;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const MAINTENANCE_CHILDREN: MaintenanceChild[] = [
  { key: 'maintenance',           label: 'لوحة الصيانة',       icon: LayoutDashboard, roles: ['admin'] },
  { key: 'maintenance-requests',  label: 'طلبات الصيانة',      icon: ClipboardList,   roles: ['admin', 'maintenance_manager'] },
  { key: 'active-maintenance',    label: 'الصيانة النشطة',     icon: Activity,        roles: ['admin', 'maintenance_manager'] },
  { key: 'maintenance-history',   label: 'سجل الصيانة',        icon: History,         roles: ['admin', 'maintenance_manager'] },
  { key: 'spare-parts',           label: 'قطع الغيار',         icon: Package,         roles: ['admin'] },
  { key: 'notifications',         label: 'التنبيهات',          icon: Bell,            roles: ['admin', 'maintenance_manager'] },
];

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard',             label: 'لوحة التحكم',        icon: LayoutDashboard, roles: ['admin', 'driver', 'manager', 'warehouse', 'logistics', 'maintenance_manager'] },
  { key: 'vehicles',              label: 'المركبات',           icon: Truck,           roles: ['admin', 'driver', 'manager', 'warehouse', 'logistics'] },
  { key: 'staff-exit',            label: 'إخراج الكادر',       icon: DoorOpen,        roles: ['admin', 'driver', 'manager', 'warehouse', 'logistics', 'gate_guard'] },
  { key: 'violations',            label: 'سجل المخالفات',      icon: Shield,          roles: ['admin'] },
  { key: 'reports',               label: 'التقارير',           icon: FileText,        roles: ['admin', 'driver', 'manager', 'warehouse', 'logistics'] },
  { key: 'users',                 label: 'إدارة المستخدمين',   icon: UserCog,         roles: ['admin'] },
  { key: 'settings',              label: 'الإعدادات',          icon: Settings,        roles: ['admin'] },
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin:               'مدير النظام',
  driver:              'سائق',
  manager:             'مدير',
  warehouse:           'مستودع',
  logistics:           'لوجستيات',
  gate_guard:          'حارس البوابة',
  maintenance_manager: 'مسؤول الصيانة',
};

/* ── Props ── */

interface LayoutProps {
  children: React.ReactNode;
  profile: UserProfile | null;
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  onSignOut: () => void;
  signingOut?: boolean;
  isDarkMode: boolean;
  onToggleDark: () => void;
}

/* ── Component ── */

export default function Layout({
  children,
  profile,
  activePage,
  onNavigate,
  onSignOut,
  signingOut = false,
  isDarkMode,
  onToggleDark,
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [maintenanceExpanded, setMaintenanceExpanded] = useState(true);

  const safeRole = profile?.role ?? 'driver';

  const isMaintenancePage = ['maintenance', 'maintenance-requests', 'active-maintenance', 'maintenance-history', 'spare-parts', 'notifications'].includes(activePage);
  const visibleMaintenanceChildren = MAINTENANCE_CHILDREN.filter((c) => c.roles.includes(safeRole));

  useEffect(() => {
    if (isMaintenancePage) setMaintenanceExpanded(true);
  }, [isMaintenancePage]);

  useEffect(() => {
    if (safeRole !== 'admin' && safeRole !== 'maintenance_manager') return;
    const fetchCount = () => {
      supabase.from('maintenance_notifications').select('id', { count: 'exact', head: true }).eq('is_read', false)
        .then(({ count }) => { if (typeof count === 'number') setUnreadNotifs(count); });
    };
    fetchCount();
    const iv = setInterval(fetchCount, 15_000);
    return () => clearInterval(iv);
  }, [safeRole]);

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles === 'all' || item.roles.includes(safeRole),
  );

  /* Sidebar content (shared between desktop & mobile) */
  function SidebarContent({ mobile = false }: { mobile?: boolean }) {
    return (
      <div className="flex flex-col h-full">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-stone-200 dark:border-stone-700/50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {(sidebarOpen || mobile) && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="font-bold text-lg whitespace-nowrap overflow-hidden"
              >
                الحسني هوم سنتر
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            if (item.key === 'vehicles') {
              return (
                <React.Fragment key={item.key}>
                  <motion.button
                    whileHover={{ x: -4 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      onNavigate(item.key);
                      if (mobile) setMobileOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                      activePage === item.key
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/60',
                    )}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <AnimatePresence>
                      {(sidebarOpen || mobile) && (
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="whitespace-nowrap overflow-hidden">
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                  {/* Collapsible Vehicle Maintenance section */}
                  {visibleMaintenanceChildren.length > 0 && (
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          if (!sidebarOpen && !mobile) {
                            const first = visibleMaintenanceChildren[0];
                            if (first) { onNavigate(first.key); if (mobile) setMobileOpen(false); }
                          } else {
                            setMaintenanceExpanded((e) => !e);
                          }
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                          isMaintenancePage
                            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                            : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/60',
                        )}
                      >
                        <Wrench className="w-5 h-5 flex-shrink-0" />
                        <AnimatePresence>
                          {(sidebarOpen || mobile) && (
                            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 text-right whitespace-nowrap overflow-hidden">
                              صيانة المركبات
                            </motion.span>
                          )}
                        </AnimatePresence>
                        {(sidebarOpen || mobile) && (
                          maintenanceExpanded ? <ChevronUp className="w-4 h-4 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 flex-shrink-0" />
                        )}
                      </button>
                      <AnimatePresence>
                        {maintenanceExpanded && (sidebarOpen || mobile) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden pr-2 space-y-0.5"
                          >
                            {visibleMaintenanceChildren.map((child) => {
                              const childActive = activePage === child.key;
                              return (
                                <motion.button
                                  key={child.key}
                                  whileHover={{ x: -2 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => {
                                    onNavigate(child.key);
                                    if (mobile) setMobileOpen(false);
                                  }}
                                  className={cn(
                                    'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200',
                                    childActive
                                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                                      : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/60',
                                  )}
                                >
                                  <div className="relative flex-shrink-0">
                                    <child.icon className="w-4 h-4" />
                                    {child.key === 'notifications' && unreadNotifs > 0 && (
                                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold">
                                        {unreadNotifs > 9 ? '9+' : unreadNotifs}
                                      </span>
                                    )}
                                  </div>
                                  <span className="whitespace-nowrap overflow-hidden text-right">
                                    {child.label}
                                    {child.key === 'notifications' && unreadNotifs > 0 && (
                                      <span className="mr-1 inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold px-0.5">
                                        {unreadNotifs}
                                      </span>
                                    )}
                                  </span>
                                </motion.button>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </React.Fragment>
              );
            }
            const active = activePage === item.key;
            return (
              <motion.button
                key={item.key}
                whileHover={{ x: -4 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  onNavigate(item.key);
                  if (mobile) setMobileOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/60',
                )}
              >
                <div className="relative flex-shrink-0">
                  <item.icon className="w-5 h-5" />
                </div>
                <AnimatePresence>
                  {(sidebarOpen || mobile) && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </nav>

        {/* User card */}
        <div className="px-3 pb-4 border-t border-stone-200 dark:border-stone-700/50 pt-4 space-y-2">
          <div className={cn('flex items-center gap-3 px-3', !sidebarOpen && !mobile && 'justify-center')}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
              <UserCircle className="w-5 h-5 text-white" />
            </div>
            <AnimatePresence>
              {(sidebarOpen || mobile) && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-sm font-semibold truncate max-w-[140px]">
                    {profile?.full_name || 'مستخدم'}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {ROLE_LABELS[safeRole]}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onSignOut}
            disabled={signingOut}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium',
              'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors',
              signingOut && 'opacity-50 cursor-not-allowed',
              !sidebarOpen && !mobile && 'justify-center',
            )}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence>
              {(sidebarOpen || mobile) && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  تسجيل الخروج
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50 dark:bg-stone-950">
      {/* ── Desktop sidebar ── */}
      <motion.aside
        animate={{ width: sidebarOpen ? 260 : 76 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden lg:flex flex-col border-l border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm relative z-30"
      >
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -left-3 top-20 w-6 h-6 rounded-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center shadow-sm hover:shadow transition-shadow"
        >
          <ChevronLeft
            className={cn(
              'w-3.5 h-3.5 transition-transform text-stone-500',
              !sidebarOpen && 'rotate-180',
            )}
          />
        </button>
      </motion.aside>

      {/* ── Mobile sidebar overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 inset-y-0 w-72 bg-white dark:bg-stone-900 shadow-2xl z-50 lg:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute left-3 top-5 p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
              <SidebarContent mobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur-lg z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Back to dashboard button — visible on sub-pages */}
            {activePage !== 'dashboard' && (
              <motion.button
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onNavigate('dashboard')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
                <span className="hidden sm:inline">الرئيسية</span>
              </motion.button>
            )}

            <h1 className="text-lg font-bold hidden sm:block text-stone-900 dark:text-white">
              {visibleItems.find((i) => i.key === activePage)?.label ?? MAINTENANCE_CHILDREN.find((c) => c.key === activePage)?.label ?? 'لوحة التحكم'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onToggleDark}
              className="p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </motion.button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Watermark */}
        <div className="text-[11px] text-stone-400 dark:text-stone-500 text-center py-2 select-none">
          Created by LaethAlkawaz &amp; Mohammed Ibrahim
        </div>
      </div>
    </div>
  );
}
