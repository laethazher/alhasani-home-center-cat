import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Truck, FileText, UserCog, Settings,
  LogOut, Menu, X, Moon, Sun, ChevronLeft, ChevronDown,
  ArrowRight, DoorOpen, Shield, Wrench,
  ClipboardList, Activity, History, Package, Bell,
  Users, CalendarCheck, BarChart3, Sparkles, CircleDot,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import type { UserProfile, UserRole } from '../lib/supabaseClient';

/* ═══════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════ */
export type PageKey =
  | 'dashboard' | 'vehicles' | 'reports' | 'bubbles' | 'staff-exit' | 'violations'
  | 'users' | 'settings' | 'maintenance' | 'maintenance-requests'
  | 'active-maintenance' | 'maintenance-history' | 'spare-parts'
  | 'notifications' | 'crew-attendance' | 'attendance-history'
  | 'attendance-reports' | 'reports-hub' | 'attendance-activity-log' | 'crew-staff';

interface NavItem   { key: PageKey; label: string; icon: React.ElementType; roles: UserRole[] | 'all' }
interface ChildItem { key: PageKey; label: string; icon: React.ElementType; roles: UserRole[] }

/* ═══════════════════════════════════════════════════════════
   DATA
═══════════════════════════════════════════════════════════ */
const MAINTENANCE_CHILDREN: ChildItem[] = [
  { key:'maintenance',          label:'لوحة الصيانة',   icon:LayoutDashboard, roles:['admin'] },
  { key:'maintenance-requests', label:'طلبات الصيانة',  icon:ClipboardList,   roles:['admin','maintenance_manager'] },
  { key:'active-maintenance',   label:'الصيانة النشطة', icon:Activity,        roles:['admin','maintenance_manager'] },
  { key:'maintenance-history',  label:'سجل الصيانة',    icon:History,         roles:['admin','maintenance_manager'] },
  { key:'spare-parts',          label:'قطع الغيار',     icon:Package,         roles:['admin'] },
  { key:'notifications',        label:'التنبيهات',      icon:Bell,            roles:['admin','maintenance_manager'] },
];

const ATTENDANCE_CHILDREN: ChildItem[] = [
  { key:'crew-attendance',         label:'الحضور اليومي', icon:CalendarCheck, roles:['admin','manager'] },
  { key:'crew-staff',              label:'الكادر',         icon:Users,         roles:['admin','manager'] },
  { key:'attendance-history',      label:'سجل الحضور',     icon:History,       roles:['admin','manager'] },
  { key:'attendance-reports',      label:'تقارير الحضور',  icon:BarChart3,     roles:['admin','manager'] },
  { key:'attendance-activity-log', label:'سجل النشاط',     icon:Activity,      roles:['admin','manager'] },
];

const NAV_ITEMS: NavItem[] = [
  { key:'dashboard',  label:'لوحة التحكم',     icon:LayoutDashboard, roles:['admin','driver','manager','warehouse','logistics','maintenance_manager'] },
  { key:'vehicles',   label:'المركبات',         icon:Truck,           roles:['admin','driver','manager','warehouse','logistics'] },
  { key:'staff-exit', label:'إخراج الكادر',     icon:DoorOpen,        roles:['admin','driver','manager','warehouse','logistics','gate_guard'] },
  { key:'violations', label:'سجل المخالفات',    icon:Shield,          roles:['admin'] },
  { key:'reports',    label:'التقارير',         icon:FileText,        roles:['admin','driver','manager','warehouse','logistics'] },
  { key:'bubbles',    label:'Bubbles',         icon:CircleDot,       roles:['admin','manager','logistics','gate_guard'] },
  { key:'reports-hub', label:'التقارير الذكية', icon:Sparkles,        roles:['admin','manager'] },
  { key:'users',      label:'إدارة المستخدمين', icon:UserCog,         roles:['admin'] },
  { key:'settings',   label:'الإعدادات',        icon:Settings,        roles:['admin'] },
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin:'مدير النظام', driver:'سائق', manager:'مدير',
  warehouse:'مستودع',  logistics:'لوجستيات',
  gate_guard:'حارس البوابة', maintenance_manager:'مسؤول الصيانة',
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin:'#60a5fa', driver:'#a78bfa', manager:'#34d399',
  warehouse:'#fbbf24', logistics:'#22d3ee',
  gate_guard:'#f472b6', maintenance_manager:'#fb923c',
};

/* ═══════════════════════════════════════════════════════════
   PROPS
═══════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════ */
export default function Layout({
  children, profile, activePage, onNavigate,
  onSignOut, signingOut = false, isDarkMode, onToggleDark,
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen]                   = useState(true);
  const [mobileOpen, setMobileOpen]                     = useState(false);
  const [unreadNotifs, setUnreadNotifs]                 = useState(0);
  const [maintenanceExpanded, setMaintenanceExpanded]   = useState(true);
  const [attendanceExpanded, setAttendanceExpanded]     = useState(true);

  const safeRole   = profile?.role ?? 'driver';
  const roleColor  = ROLE_COLORS[safeRole] ?? '#60a5fa';

  const isMaintenancePage = ['maintenance','maintenance-requests','active-maintenance','maintenance-history','spare-parts','notifications'].includes(activePage);
  const isAttendancePage  = ['crew-attendance','crew-staff','attendance-history','attendance-reports','attendance-activity-log'].includes(activePage);

  const visibleMaintenanceChildren = MAINTENANCE_CHILDREN.filter(c => c.roles.includes(safeRole));
  const visibleAttendanceChildren  = ATTENDANCE_CHILDREN.filter(c => c.roles.includes(safeRole));
  const visibleItems = NAV_ITEMS.filter(i => i.roles === 'all' || i.roles.includes(safeRole));

  const currentPageLabel =
    visibleItems.find(i => i.key === activePage)?.label ??
    MAINTENANCE_CHILDREN.find(c => c.key === activePage)?.label ??
    ATTENDANCE_CHILDREN.find(c => c.key === activePage)?.label ??
    'لوحة التحكم';

  useEffect(() => { if (isMaintenancePage) setMaintenanceExpanded(true); }, [isMaintenancePage]);
  useEffect(() => { if (isAttendancePage)  setAttendanceExpanded(true);  }, [isAttendancePage]);

  useEffect(() => {
    if (safeRole !== 'admin' && safeRole !== 'maintenance_manager') return;
    const fetch = () => supabase.from('maintenance_notifications')
      .select('id', { count:'exact', head:true }).eq('is_read', false)
      .then(({ count }) => { if (typeof count === 'number') setUnreadNotifs(count); });
    fetch();
    const iv = setInterval(fetch, 15_000);
    return () => clearInterval(iv);
  }, [safeRole]);

  /* ─── NAV BUTTON ─── */
  function NavBtn({ item, mobile }: { item: NavItem; mobile?: boolean; key?: React.Key }) {
    const active = activePage === item.key;
    return (
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={() => { onNavigate(item.key); if (mobile) setMobileOpen(false); }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium relative overflow-hidden group transition-all duration-200"
        style={{
          background: active
            ? isDarkMode ? `linear-gradient(135deg,${roleColor}22,${roleColor}10)` : `linear-gradient(135deg,${roleColor}18,${roleColor}08)`
            : 'transparent',
          border: active ? `1px solid ${roleColor}35` : '1px solid transparent',
        }}
      >
        {/* Active right indicator */}
        {active && (
          <motion.div
            layoutId={`active-ind-${mobile ? 'mob' : 'desk'}`}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-l-full"
            style={{ background: roleColor, boxShadow: `0 0 8px ${roleColor}` }}
            transition={{ type:'spring', stiffness:380, damping:30 }}
          />
        )}
        {/* Hover bg */}
        {!active && (
          <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
          />
        )}
        <item.icon className="w-4 h-4 flex-shrink-0 relative z-10" style={{
          color: active ? roleColor : isDarkMode ? '#475569' : '#94a3b8',
          filter: active ? `drop-shadow(0 0 6px ${roleColor}80)` : 'none',
          transition: 'all 0.2s ease',
        }}/>
        <AnimatePresence>
          {(sidebarOpen || mobile) && (
            <motion.span
              initial={{ opacity:0, width:0 }}
              animate={{ opacity:1, width:'auto' }}
              exit={{ opacity:0, width:0 }}
              className="whitespace-nowrap overflow-hidden relative z-10"
              style={{ color: active ? (isDarkMode ? '#f1f5f9' : '#1e293b') : isDarkMode ? '#64748b' : '#64748b' }}
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    );
  }

  /* ─── CHILD BUTTON ─── */
  function ChildBtn({ child, mobile, accentColor }: { child: ChildItem; mobile?: boolean; accentColor: string; key?: React.Key }) {
    const active   = activePage === child.key;
    const hasNotif = child.key === 'notifications' && unreadNotifs > 0;
    return (
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={() => { onNavigate(child.key); if (mobile) setMobileOpen(false); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium relative overflow-hidden group transition-all duration-200"
        style={{
          background: active ? `${accentColor}18` : 'transparent',
          border: `1px solid ${active ? accentColor + '30' : 'transparent'}`,
        }}
      >
        {!active && (
          <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
          />
        )}
        <div className="w-px h-4 flex-shrink-0 rounded-full" style={{
          background: active ? accentColor : isDarkMode ? '#1e293b' : '#e2e8f0',
        }}/>
        <child.icon className="w-3.5 h-3.5 flex-shrink-0 relative z-10" style={{
          color: active ? accentColor : isDarkMode ? '#475569' : '#94a3b8',
          transition: 'color 0.2s ease',
        }}/>
        <span className="flex-1 text-right relative z-10 truncate" style={{
          color: active ? (isDarkMode ? '#f1f5f9' : '#1e293b') : isDarkMode ? '#475569' : '#94a3b8',
        }}>
          {child.label}
        </span>
        {hasNotif && (
          <span className="text-[10px] font-black text-white rounded-full px-1.5 py-0.5 flex-shrink-0" style={{
            background: accentColor, boxShadow: `0 0 8px ${accentColor}80`,
          }}>
            {unreadNotifs > 9 ? '9+' : unreadNotifs}
          </span>
        )}
      </motion.button>
    );
  }

  /* ─── GROUP SECTION ─── */
  function GroupSection({
    label, icon: GIcon, accentColor, children: groupChildren,
    expanded, onToggle, isActive, mobile,
  }: {
    label: string; icon: React.ElementType; accentColor: string;
    children: ChildItem[]; expanded: boolean; onToggle: () => void;
    isActive: boolean; mobile?: boolean;
  }) {
    return (
      <div className="space-y-0.5">
        <button
          onClick={() => {
            if (!sidebarOpen && !mobile) { onNavigate(groupChildren[0].key); }
            else onToggle();
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
          style={{
            background: isActive
              ? isDarkMode ? `${accentColor}15` : `${accentColor}10`
              : 'transparent',
            border: `1px solid ${isActive ? accentColor + '25' : 'transparent'}`,
          }}
        >
          <GIcon className="w-4 h-4 flex-shrink-0" style={{
            color: isActive ? accentColor : isDarkMode ? '#475569' : '#94a3b8',
            filter: isActive ? `drop-shadow(0 0 5px ${accentColor}70)` : 'none',
            transition: 'all 0.2s ease',
          }}/>
          <AnimatePresence>
            {(sidebarOpen || mobile) && (
              <motion.span
                initial={{ opacity:0, width:0 }}
                animate={{ opacity:1, width:'auto' }}
                exit={{ opacity:0, width:0 }}
                className="flex-1 text-right whitespace-nowrap overflow-hidden"
                style={{ color: isActive ? (isDarkMode ? '#f1f5f9' : '#1e293b') : isDarkMode ? '#64748b' : '#64748b' }}
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
          {(sidebarOpen || mobile) && (
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration:0.25 }}>
              <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{
                color: isActive ? accentColor : isDarkMode ? '#334155' : '#cbd5e1',
              }}/>
            </motion.div>
          )}
        </button>
        <AnimatePresence>
          {expanded && (sidebarOpen || mobile) && (
            <motion.div
              initial={{ height:0, opacity:0 }}
              animate={{ height:'auto', opacity:1 }}
              exit={{ height:0, opacity:0 }}
              transition={{ duration:0.22, ease:[0.22,1,0.36,1] }}
              className="overflow-hidden space-y-0.5 pr-1"
            >
              {groupChildren.map(child => (
                <ChildBtn key={child.key} child={child} mobile={mobile} accentColor={accentColor}/>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ─── SIDEBAR CONTENT ─── */
  function SidebarContent({ mobile = false }: { mobile?: boolean }) {
    const show = sidebarOpen || mobile;
    return (
      <div className="flex flex-col h-full">

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 flex-shrink-0" style={{
          borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)',
        }}>
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
              background: 'linear-gradient(135deg,#2563eb,#4f46e5)',
              boxShadow: '0 4px 16px rgba(79,70,229,0.4)',
            }}>
              <Truck style={{ width:18, height:18, color:'#fff' }}/>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2" style={{
              background:'#22c55e',
              borderColor: isDarkMode ? '#0d1117' : '#ffffff',
              boxShadow:'0 0 6px rgba(34,197,94,0.6)',
            }}/>
          </div>
          <AnimatePresence>
            {show && (
              <motion.div
                initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-8 }}
                className="overflow-hidden"
              >
                <p className="text-sm font-black leading-tight whitespace-nowrap" style={{ color: isDarkMode ? '#f1f5f9' : '#0f172a' }}>
                  الحسني هوم سنتر
                </p>
                <p className="text-[10px] font-semibold whitespace-nowrap" style={{ color: isDarkMode ? '#334155' : '#94a3b8' }}>
                  Fleet Management System
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto" style={{ scrollbarWidth:'none' }}>
          {show && (
            <p className="text-[10px] font-black tracking-[0.14em] uppercase px-3 pb-2 pt-1"
              style={{ color: isDarkMode ? '#1e293b' : '#cbd5e1' }}>
              القائمة الرئيسية
            </p>
          )}

          {visibleItems.map(item => <NavBtn key={item.key} item={item} mobile={mobile}/>)}

          {(visibleMaintenanceChildren.length > 0 || visibleAttendanceChildren.length > 0) && (
            <div className="my-3 mx-1" style={{ height:'1px', background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)' }}/>
          )}

          {show && (visibleMaintenanceChildren.length > 0 || visibleAttendanceChildren.length > 0) && (
            <p className="text-[10px] font-black tracking-[0.14em] uppercase px-3 pb-2"
              style={{ color: isDarkMode ? '#1e293b' : '#cbd5e1' }}>
              الأقسام المتخصصة
            </p>
          )}

          {visibleMaintenanceChildren.length > 0 && (
            <GroupSection
              label="صيانة المركبات" icon={Wrench} accentColor="#fb923c"
              children={visibleMaintenanceChildren}
              expanded={maintenanceExpanded} onToggle={() => setMaintenanceExpanded(e => !e)}
              isActive={isMaintenancePage} mobile={mobile}
            />
          )}

          {visibleAttendanceChildren.length > 0 && (
            <GroupSection
              label="حضور الكادر" icon={Users} accentColor="#34d399"
              children={visibleAttendanceChildren}
              expanded={attendanceExpanded} onToggle={() => setAttendanceExpanded(e => !e)}
              isActive={isAttendancePage} mobile={mobile}
            />
          )}
        </nav>

        {/* User Card */}
        <div className="px-2.5 pb-4 pt-3 flex-shrink-0" style={{
          borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)',
        }}>
          <div className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5', !show && 'justify-center')} style={{
            background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            border: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)',
          }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-sm text-white" style={{
              background: `linear-gradient(135deg,${roleColor}cc,${roleColor}88)`,
              boxShadow: `0 2px 10px ${roleColor}40`,
            }}>
              {profile?.full_name?.charAt(0) ?? '؟'}
            </div>
            <AnimatePresence>
              {show && (
                <motion.div
                  initial={{ opacity:0, width:0 }} animate={{ opacity:1, width:'auto' }} exit={{ opacity:0, width:0 }}
                  className="overflow-hidden flex-1 min-w-0"
                >
                  <p className="text-sm font-bold truncate text-right" style={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
                    {profile?.full_name ?? 'مستخدم'}
                  </p>
                  <p className="text-[11px] truncate text-right" style={{ color: roleColor }}>
                    {ROLE_LABELS[safeRole]}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            whileTap={{ scale:0.95 }}
            onClick={onSignOut}
            disabled={signingOut}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200',
              !show && 'justify-center',
              signingOut && 'opacity-40 cursor-not-allowed',
            )}
            style={{ color: isDarkMode ? '#ef4444' : '#dc2626', border:'1px solid transparent' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = isDarkMode ? 'rgba(239,68,68,0.1)' : 'rgba(220,38,38,0.06)';
              (e.currentTarget as HTMLElement).style.borderColor = isDarkMode ? 'rgba(239,68,68,0.2)' : 'rgba(220,38,38,0.15)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
            }}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" style={{ color: isDarkMode ? '#ef4444' : '#dc2626' }}/>
            <AnimatePresence>
              {show && (
                <motion.span initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
                  تسجيل الخروج
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    );
  }

  /* ─── STYLES ─── */
  const sidebarStyle: React.CSSProperties = {
    background: isDarkMode ? 'transparent' : 'linear-gradient(180deg,#ffffff,#fafbfc)',
    borderLeft: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.07)',
    boxShadow: isDarkMode ? 'none' : '4px 0 24px rgba(0,0,0,0.04)',
    transition: 'all 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
  };

  const headerStyle: React.CSSProperties = {
    background: isDarkMode ? 'rgba(6, 10, 18, 0.8)' : 'rgba(255,255,255,0.85)',
    borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)',
    backdropFilter: 'blur(20px)',
    transition: 'all 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
  };

  /* ─── RENDER ─── */
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: isDarkMode ? '#060a12' : '#f1f5f9' }}>

      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: sidebarOpen ? 256 : 68 }}
        transition={{ type:'spring', stiffness:320, damping:32 }}
        className="hidden lg:flex flex-col relative z-30 flex-shrink-0"
        style={sidebarStyle}
      >
        <SidebarContent/>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -left-3 top-[88px] w-6 h-6 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
          style={{
            background: isDarkMode ? '#1e293b' : '#ffffff',
            border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
            boxShadow: isDarkMode ? '0 2px 12px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,0,0,0.1)',
          }}
        >
          <ChevronLeft className={cn('w-3 h-3 transition-transform duration-300', !sidebarOpen && 'rotate-180')}
            style={{ color: isDarkMode ? '#64748b' : '#94a3b8' }}/>
        </button>
      </motion.aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 lg:hidden"
              style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}
            />
            <motion.aside
              initial={{ x:300 }} animate={{ x:0 }} exit={{ x:300 }}
              transition={{ type:'spring', stiffness:320, damping:32 }}
              className="fixed right-0 inset-y-0 w-72 z-50 lg:hidden flex flex-col"
              style={sidebarStyle}
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute left-3 top-4 w-8 h-8 flex items-center justify-center rounded-lg"
                style={{ background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: isDarkMode ? '#64748b' : '#94a3b8' }}
              >
                <X className="w-4 h-4"/>
              </button>
              <SidebarContent mobile/>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 md:px-5 z-20 flex-shrink-0" style={headerStyle}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl"
              style={{ background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', color: isDarkMode ? '#64748b' : '#94a3b8' }}
            >
              <Menu className="w-4 h-4"/>
            </button>

            <AnimatePresence>
              {activePage !== 'dashboard' && (
                <motion.button
                  initial={{ opacity:0, x:8 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:8 }}
                  whileTap={{ scale:0.95 }}
                  onClick={() => onNavigate('dashboard')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200"
                  style={{
                    background: isDarkMode ? 'rgba(96,165,250,0.1)' : 'rgba(59,130,246,0.08)',
                    color:'#3b82f6',
                    border: isDarkMode ? '1px solid rgba(96,165,250,0.2)' : '1px solid rgba(59,130,246,0.15)',
                  }}
                >
                  <ArrowRight className="w-3.5 h-3.5"/>
                  <span className="hidden sm:inline">الرئيسية</span>
                </motion.button>
              )}
            </AnimatePresence>

            <div className="hidden sm:flex items-center gap-2">
              <div className="w-1 h-4 rounded-full" style={{ background:`linear-gradient(to bottom,${roleColor},${roleColor}60)` }}/>
              <h1 className="text-sm font-bold" style={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
                {currentPageLabel}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadNotifs > 0 && (
              <motion.button
                initial={{ scale:0 }} animate={{ scale:1 }}
                onClick={() => onNavigate('notifications')}
                className="relative w-9 h-9 flex items-center justify-center rounded-xl"
                style={{ background: isDarkMode ? 'rgba(251,146,60,0.1)' : 'rgba(251,146,60,0.08)', border:'1px solid rgba(251,146,60,0.2)' }}
              >
                <Bell className="w-4 h-4" style={{ color:'#fb923c' }}/>
                <span className="absolute -top-1 -right-1 text-[9px] font-black text-white rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center"
                  style={{ background:'#ef4444', boxShadow:'0 0 8px rgba(239,68,68,0.6)' }}>
                  {unreadNotifs > 9 ? '9+' : unreadNotifs}
                </span>
              </motion.button>
            )}

            <motion.button
              whileTap={{ scale:0.9 }}
              onClick={onToggleDark}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200"
              style={{
                background: isDarkMode ? 'rgba(251,191,36,0.1)' : 'rgba(99,102,241,0.08)',
                border: isDarkMode ? '1px solid rgba(251,191,36,0.2)' : '1px solid rgba(99,102,241,0.15)',
              }}
            >
              {isDarkMode
                ? <Sun  className="w-4 h-4" style={{ color:'#fbbf24', filter:'drop-shadow(0 0 6px rgba(251,191,36,0.8))' }}/>
                : <Moon className="w-4 h-4" style={{ color:'#6366f1' }}/>
              }
            </motion.button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity:0, y:10 }}
              animate={{ opacity:1, y:0 }}
              exit={{ opacity:0, y:-10 }}
              transition={{ duration:0.18, ease:[0.22,1,0.36,1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Watermark */}
        <div className="text-[10px] text-center py-2 select-none font-medium"
          style={{ color: isDarkMode ? '#1e293b' : '#e2e8f0' }}>
          Created by LaethAlkawaz &amp; Mohammed Ibrahim
        </div>
      </div>
    </div>
  );
}