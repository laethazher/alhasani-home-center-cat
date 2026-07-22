import React from 'react';
import { motion } from 'framer-motion';
import {
  Truck, FileText, DoorOpen, UserCog, Settings,
  Wrench, ClipboardList, Activity, History, Package, Bell, Shield, Sparkles,
  CalendarCheck, Users, BarChart3,
} from 'lucide-react';
import DashboardCard from '../components/DashboardCard';
import type { UserProfile, UserRole } from '../lib/supabaseClient';
import type { PageKey } from '../components/Layout';
import type { DepartmentCode } from '../data/department';
import InspectionAlertBanner from '../components/inspection-intelligence/InspectionAlertBanner';

interface DashboardProps {
  profile: UserProfile;
  onNavigate: (page: PageKey) => void;
  department?: DepartmentCode;
}

interface CardDef {
  key: PageKey;
  title: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  roles: UserRole[] | 'all';
}

const CARDS: CardDef[] = [
  { key:'vehicles',             title:'المركبات',           description:'إدارة ومتابعة حالة جميع المركبات والمعدات',      icon:Truck,         gradient:'from-blue-500 to-indigo-600',   roles:['admin','driver','manager','warehouse','logistics','installation_department','installation_admin'] },
  { key:'maintenance',          title:'صيانة المركبات',      description:'لوحة تحكم الصيانة والإحصائيات والتحليلات',       icon:Wrench,        gradient:'from-cyan-500 to-blue-600',     roles:['admin','installation_department','installation_admin'] },
  { key:'maintenance-requests', title:'طلبات الصيانة',       description:'إنشاء ومتابعة طلبات الصيانة والموافقة عليها',    icon:ClipboardList, gradient:'from-indigo-500 to-violet-600', roles:['admin','maintenance_manager','installation_department','installation_admin'] },
  { key:'active-maintenance',   title:'الصيانة النشطة',      description:'متابعة الصيانة الجارية والتقاط صور العمل',       icon:Activity,      gradient:'from-teal-500 to-emerald-600',  roles:['admin','maintenance_manager','installation_department','installation_admin'] },
  { key:'maintenance-history',  title:'سجل الصيانة',         description:'عرض سجل جميع عمليات الصيانة وتصدير التقارير',    icon:History,       gradient:'from-sky-500 to-blue-600',      roles:['admin','maintenance_manager','installation_department','installation_admin'] },
  { key:'spare-parts',          title:'قطع الغيار',          description:'إدارة مخزن قطع الغيار والموردين',                icon:Package,       gradient:'from-orange-500 to-amber-600',  roles:['admin','installation_department','installation_admin'] },
  { key:'notifications',        title:'التنبيهات',           description:'تنبيهات الصيانة الدورية وانتهاء التأمين والفحص', icon:Bell,          gradient:'from-pink-500 to-rose-600',     roles:['admin','maintenance_manager','installation_department','installation_admin'] },
  { key:'staff-exit',           title:'إخراج الكادر',        description:'تسجيل ومتابعة عمليات خروج الكوادر',              icon:DoorOpen,      gradient:'from-emerald-500 to-teal-600',  roles:'all' },
  { key:'violations',           title:'سجل المخالفات',       description:'تسجيل ومتابعة مخالفات الموظفين',                 icon:Shield,        gradient:'from-red-500 to-rose-600',      roles:['admin','installation_admin'] },
  { key:'reports',              title:'التقارير',            description:'عرض وتصدير التقارير اليومية والأسبوعية',         icon:FileText,      gradient:'from-amber-500 to-orange-600',  roles:['admin','driver','manager','warehouse','logistics','installation_department','installation_admin'] },
  { key:'reports-hub',          title:'التقارير الذكية',     description:'بحث وفلترة وتصدير موحّد للحضور والمركبات والمخالفات', icon:Sparkles,   gradient:'from-fuchsia-500 to-violet-600', roles:['admin','manager','installation_department','installation_admin'] },
  { key:'users',                title:'إدارة المستخدمين',    description:'إضافة وإدارة حسابات المستخدمين والصلاحيات',     icon:UserCog,       gradient:'from-violet-500 to-purple-600', roles:['admin'] },
  { key:'settings',             title:'الإعدادات',           description:'ضبط إعدادات النظام والتفضيلات العامة',           icon:Settings,      gradient:'from-rose-500 to-pink-600',     roles:['admin'] },
];

/** لوحة التركيب: اختصارات حضور الكادر مربوطة بنفس الجداول المعزولة (installation_*) */
const INSTALLATION_ATTENDANCE_CARDS: CardDef[] = [
  { key:'crew-attendance',         title:'الحضور اليومي',   description:'تسجيل حضور وغياب كادر التركيب يومياً',           icon:CalendarCheck, gradient:'from-emerald-500 to-teal-600',   roles:['admin','manager','installation_department'] },
  { key:'crew-staff',              title:'الكادر',            description:'عرض أعضاء كادر التركيب وسجلاتهم',                 icon:Users,         gradient:'from-sky-500 to-cyan-600',       roles:['admin','manager','installation_department'] },
  { key:'attendance-history',      title:'سجل الحضور',       description:'أرشيف أيام الحضور المؤرشفة لقسم التركيب',        icon:History,       gradient:'from-slate-500 to-zinc-600',      roles:['admin','manager','installation_department'] },
  { key:'attendance-reports',      title:'تقارير الحضور',     description:'تقارير مجمّعة عن الحضور والغياب',                icon:BarChart3,     gradient:'from-violet-500 to-purple-600',   roles:['admin','manager','installation_department'] },
  { key:'attendance-activity-log', title:'سجل النشاط',       description:'تدقيق تغييرات سجلات الحضور',                     icon:Activity,      gradient:'from-amber-500 to-orange-600',   roles:['admin','manager','installation_department'] },
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin:'مدير النظام', driver:'سائق', manager:'مدير',
  warehouse:'مستودع',  logistics:'لوجستيات',
  gate_guard:'حارس البوابة', maintenance_manager:'مسؤول الصيانة',
  installation_department:'قسم التركيب',
  installation_admin:'موظف تجهيز اداري',
};

const ROLE_META: Record<UserRole, { color:string; bgDark:string; bgLight:string; border:string }> = {
  admin:               { color:'#60a5fa', bgDark:'rgba(96,165,250,0.12)',  bgLight:'#dbeafe', border:'rgba(96,165,250,0.3)'  },
  manager:             { color:'#34d399', bgDark:'rgba(52,211,153,0.12)',  bgLight:'#d1fae5', border:'rgba(52,211,153,0.3)'  },
  maintenance_manager: { color:'#fb923c', bgDark:'rgba(251,146,60,0.12)', bgLight:'#ffedd5', border:'rgba(251,146,60,0.3)'  },
  driver:              { color:'#a78bfa', bgDark:'rgba(167,139,250,0.12)',bgLight:'#ede9fe', border:'rgba(167,139,250,0.3)' },
  warehouse:           { color:'#fbbf24', bgDark:'rgba(251,191,36,0.12)', bgLight:'#fef3c7', border:'rgba(251,191,36,0.3)'  },
  logistics:           { color:'#22d3ee', bgDark:'rgba(34,211,238,0.12)', bgLight:'#cffafe', border:'rgba(34,211,238,0.3)'  },
  gate_guard:          { color:'#f472b6', bgDark:'rgba(244,114,182,0.12)',bgLight:'#fce7f3', border:'rgba(244,114,182,0.3)' },
  installation_department:{ color:'#14b8a6', bgDark:'rgba(20,184,166,0.12)',bgLight:'#ccfbf1', border:'rgba(20,184,166,0.3)' },
  installation_admin:{ color:'#818cf8', bgDark:'rgba(129,140,248,0.12)', bgLight:'#e0e7ff', border:'rgba(129,140,248,0.3)' },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return { ar:'ليلة طيبة',  emoji:'🌙' };
  if (h < 12) return { ar:'صباح الخير', emoji:'☀️' };
  if (h < 17) return { ar:'مساء الخير', emoji:'🌤️' };
  return           { ar:'مساء النور',  emoji:'🌆' };
}

/* ── DARK HERO ── */
function DarkHero({ profile, count, departmentTag }: { profile: UserProfile; count: number; departmentTag?: string | null }) {
  const { ar, emoji } = getGreeting();
  const firstName = profile.full_name?.split(' ')[0] ?? '';
  const role = ROLE_META[profile.role] ?? ROLE_META.driver;
  const roleLabel = ROLE_LABELS[profile.role] ?? '';
  const date = new Date().toLocaleDateString('ar-IQ', { weekday:'long', month:'long', day:'numeric' });

  return (
    <motion.div
      initial={{ opacity:0, y:-18 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.65, ease:[0.22,1,0.36,1] }}
      className="relative rounded-2xl overflow-hidden"
      style={{
        background:'linear-gradient(135deg,#080c18 0%,#0c1526 45%,#08101e 100%)',
        border:'1px solid rgba(255,255,255,0.055)',
        boxShadow:'0 8px 48px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Grid */}
      <div className="absolute inset-0 opacity-[0.035]" style={{
        backgroundImage:`linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)`,
        backgroundSize:'44px 44px',
      }}/>
      {/* Orbs */}
      <div className="absolute top-0 right-0 pointer-events-none" style={{ width:300,height:300, background:'radial-gradient(circle,rgba(96,165,250,0.07),transparent 70%)', transform:'translate(25%,-25%)' }}/>
      <div className="absolute bottom-0 left-0 pointer-events-none" style={{ width:220,height:220, background:`radial-gradient(circle,${role.color}0d,transparent 70%)`, transform:'translate(-15%,15%)' }}/>
      {/* Divider line */}
      <div className="absolute inset-y-0 pointer-events-none" style={{ right:'32%', width:'1px', background:'linear-gradient(to bottom,transparent,rgba(96,165,250,0.12),transparent)' }}/>

      <div className="relative z-10 p-7 md:p-9">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">{emoji}</span>
              <span className="text-sm" style={{ color:'#475569' }}>{ar}</span>
            </div>
            <div>
              <h2 className="text-4xl font-black tracking-tight leading-none" style={{ color:'#f1f5f9', textShadow:'0 0 40px rgba(96,165,250,0.2)' }}>
                Alhasani Home Center Logistics
              </h2>
              {departmentTag ? (
                <p className="text-xs font-bold mt-2" style={{ color:'#34d399' }}>{departmentTag}</p>
              ) : null}
              <div className="flex items-center gap-2.5 mt-3 flex-wrap">
                <div className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background:role.bgDark, border:`1px solid ${role.border}` }}>
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:role.color, boxShadow:`0 0 6px ${role.color}` }}/>
                  <span className="text-xs font-bold" style={{ color:role.color }}>{roleLabel}</span>
                </div>
                <span style={{ color:'#1e293b' }}>·</span>
                <span className="text-xs" style={{ color:'#334155' }}>{date}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-3 flex-shrink-0">
            {[
              { label:'الأقسام',  value:count,   color:'#60a5fa', glow:'rgba(96,165,250,0.4)'  },
              { label:'النظام',   value:'نشط',   color:'#34d399', glow:'rgba(52,211,153,0.4)'  },
              { label:'المركبات', value:'🚛',    color:'#fb923c', glow:'rgba(251,146,60,0.4)'  },
            ].map((s,i) => (
              <motion.div key={i}
                initial={{ opacity:0,scale:0.85 }} animate={{ opacity:1,scale:1 }}
                transition={{ delay:0.15+i*0.07, type:'spring', stiffness:280, damping:22 }}
                className="rounded-xl px-4 py-3.5 text-center"
                style={{ minWidth:80, background:'rgba(255,255,255,0.025)', border:`1px solid ${s.color}18`, boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04),0 4px 16px rgba(0,0,0,0.3)' }}
              >
                <div className="text-2xl font-black leading-none" style={{ color:s.color, textShadow:`0 0 24px ${s.glow}` }}>{s.value}</div>
                <div className="text-[10px] mt-1.5 font-semibold tracking-wide" style={{ color:'#334155' }}>{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom shimmer */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{
        background:'linear-gradient(90deg,transparent,rgba(96,165,250,0.25) 30%,rgba(52,211,153,0.18) 70%,transparent)',
      }}/>
    </motion.div>
  );
}

/* ── LIGHT HERO ── */
function LightHero({ profile, count, departmentTag }: { profile: UserProfile; count: number; departmentTag?: string | null }) {
  const { ar, emoji } = getGreeting();
  const firstName = profile.full_name?.split(' ')[0] ?? '';
  const role = ROLE_META[profile.role] ?? ROLE_META.driver;
  const roleLabel = ROLE_LABELS[profile.role] ?? '';
  const date = new Date().toLocaleDateString('ar-IQ', { weekday:'long', month:'long', day:'numeric' });

  return (
    <motion.div
      initial={{ opacity:0, y:-18 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.65, ease:[0.22,1,0.36,1] }}
      className="relative rounded-2xl overflow-hidden"
      style={{
        background:'linear-gradient(135deg,#ffffff 0%,#f0f7ff 50%,#f5f3ff 100%)',
        border:'1px solid rgba(0,0,0,0.07)',
        boxShadow:'0 4px 32px rgba(0,0,0,0.07),0 1px 3px rgba(0,0,0,0.04),inset 0 1px 0 #fff',
      }}
    >
      {/* Dot grid */}
      <div className="absolute inset-0 opacity-40" style={{
        backgroundImage:'radial-gradient(circle,#94a3b820 1px,transparent 1px)',
        backgroundSize:'28px 28px',
      }}/>
      {/* Color wash */}
      <div className="absolute top-0 right-0 pointer-events-none" style={{ width:280,height:280, background:'radial-gradient(circle,rgba(96,165,250,0.08),transparent 70%)', transform:'translate(20%,-20%)' }}/>
      <div className="absolute bottom-0 left-0 pointer-events-none" style={{ width:200,height:200, background:`radial-gradient(circle,${role.color}12,transparent 70%)`, transform:'translate(-10%,10%)' }}/>

      <div className="relative z-10 p-7 md:p-9">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">{emoji}</span>
              <span className="text-sm font-medium text-slate-500">{ar}</span>
            </div>
            <div>
              <h2 className="text-4xl font-black tracking-tight leading-none text-slate-900">Alhasani Home Center Logistics</h2>
              {departmentTag ? (
                <p className="text-xs font-bold text-emerald-600 mt-2">{departmentTag}</p>
              ) : null}
              <div className="flex items-center gap-2.5 mt-3 flex-wrap">
                <div className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background:role.bgLight, border:`1px solid ${role.color}40` }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background:role.color }}/>
                  <span className="text-xs font-bold" style={{ color:role.color }}>{roleLabel}</span>
                </div>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-400">{date}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-3 flex-shrink-0">
            {[
              { label:'الأقسام',  value:count,  color:'#3b82f6', bg:'#eff6ff', border:'#bfdbfe' },
              { label:'النظام',   value:'نشط',  color:'#10b981', bg:'#f0fdf4', border:'#bbf7d0' },
              { label:'المركبات', value:'🚛',   color:'#f59e0b', bg:'#fffbeb', border:'#fde68a' },
            ].map((s,i) => (
              <motion.div key={i}
                initial={{ opacity:0,scale:0.85 }} animate={{ opacity:1,scale:1 }}
                transition={{ delay:0.15+i*0.07, type:'spring', stiffness:280, damping:22 }}
                className="rounded-xl px-4 py-3.5 text-center"
                style={{ minWidth:80, background:s.bg, border:`1px solid ${s.border}`, boxShadow:'0 2px 8px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,0.8)' }}
              >
                <div className="text-2xl font-black leading-none" style={{ color:s.color }}>{s.value}</div>
                <div className="text-[10px] mt-1.5 font-semibold tracking-wide text-slate-400">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Rainbow bottom line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{
        background:'linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899,#f59e0b)',
        opacity:0.5,
      }}/>
    </motion.div>
  );
}

/* ── SECTION LABEL ── */
function SectionLabel({ count, label, unit }: { count: number; label?: string; unit?: string }) {
  const title = label ?? 'الأقسام';
  const suffix = unit ?? 'قسم';
  return (
    <motion.div
      initial={{ opacity:0,x:12 }} animate={{ opacity:1,x:0 }}
      transition={{ delay:0.25, duration:0.5 }}
      className="flex items-center gap-3"
    >
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full" style={{ background:'linear-gradient(to bottom,#3b82f6,#8b5cf6)' }}/>
        <span className="text-[11px] font-black tracking-[0.16em] uppercase text-slate-400 dark:text-slate-600">{title}</span>
      </div>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent to-slate-200 dark:to-slate-800"/>
      <span className="text-[11px] font-semibold text-slate-300 dark:text-slate-700">{count} {suffix}</span>
    </motion.div>
  );
}

/* ── MAIN ── */
export default function Dashboard({ profile, onNavigate, department = 'tajhiz' }: DashboardProps) {
  const baseVisible = CARDS.filter((c) => c.roles === 'all' || c.roles.includes(profile.role));
  const extraAttendance =
    department === 'installation'
      ? INSTALLATION_ATTENDANCE_CARDS.filter((c) => c.roles.includes(profile.role))
      : [];
  const seen = new Set<PageKey>();
  const visible = [...baseVisible, ...extraAttendance].filter((c) => {
    if (seen.has(c.key)) return false;
    seen.add(c.key);
    return true;
  });
  const departmentTag = department === 'installation' ? 'قسم التركيب — بيانات معزولة عن التجهيز' : null;

  return (
    <div className="space-y-8">
      <span className="hidden dark:block"><DarkHero profile={profile} count={visible.length} departmentTag={departmentTag}/></span>
      <span className="dark:hidden"><LightHero profile={profile} count={visible.length} departmentTag={departmentTag}/></span>
      <InspectionAlertBanner
        department={department}
        onOpenIntelligence={() => onNavigate('intelligence')}
        onGoToReports={() => onNavigate('reports')}
      />
      <SectionLabel
        count={visible.length}
        label={department === 'installation' ? 'وحدات سريعة' : undefined}
        unit={department === 'installation' ? 'وحدة' : undefined}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((card,i) => (
          <DashboardCard
            key={card.key} title={card.title} description={card.description}
            icon={card.icon} gradient={card.gradient} index={i}
            onClick={() => onNavigate(card.key)}
          />
        ))}
      </div>
    </div>
  );
}