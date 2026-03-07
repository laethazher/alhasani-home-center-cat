import React from 'react';
import {
  Truck, FileText, DoorOpen, UserCog, Settings,
  Wrench, ClipboardList, Activity, History, Package, Bell, Shield,
} from 'lucide-react';
import DashboardCard from '../components/DashboardCard';
import type { UserProfile, UserRole } from '../lib/supabaseClient';
import type { PageKey } from '../components/Layout';

interface DashboardProps {
  profile: UserProfile;
  onNavigate: (page: PageKey) => void;
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
  {
    key: 'vehicles',
    title: 'المركبات',
    description: 'إدارة ومتابعة حالة جميع المركبات والمعدات',
    icon: Truck,
    gradient: 'from-blue-500 to-indigo-600',
    roles: ['admin', 'driver', 'manager', 'warehouse', 'logistics'],
  },
  {
    key: 'maintenance',
    title: 'صيانة المركبات',
    description: 'لوحة تحكم الصيانة والإحصائيات والتحليلات',
    icon: Wrench,
    gradient: 'from-cyan-500 to-blue-600',
    roles: ['admin'],
  },
  {
    key: 'maintenance-requests',
    title: 'طلبات الصيانة',
    description: 'إنشاء ومتابعة طلبات الصيانة والموافقة عليها',
    icon: ClipboardList,
    gradient: 'from-indigo-500 to-violet-600',
    roles: ['admin', 'maintenance_manager'],
  },
  {
    key: 'active-maintenance',
    title: 'الصيانة النشطة',
    description: 'متابعة الصيانة الجارية والتقاط صور العمل',
    icon: Activity,
    gradient: 'from-teal-500 to-emerald-600',
    roles: ['admin', 'maintenance_manager'],
  },
  {
    key: 'maintenance-history',
    title: 'سجل الصيانة',
    description: 'عرض سجل جميع عمليات الصيانة وتصدير التقارير',
    icon: History,
    gradient: 'from-sky-500 to-blue-600',
    roles: ['admin', 'maintenance_manager'],
  },
  {
    key: 'spare-parts',
    title: 'قطع الغيار',
    description: 'إدارة مخزن قطع الغيار والموردين',
    icon: Package,
    gradient: 'from-orange-500 to-amber-600',
    roles: ['admin'],
  },
  {
    key: 'notifications',
    title: 'التنبيهات',
    description: 'تنبيهات الصيانة الدورية وانتهاء التأمين والفحص',
    icon: Bell,
    gradient: 'from-pink-500 to-rose-600',
    roles: ['admin', 'maintenance_manager'],
  },
  {
    key: 'staff-exit',
    title: 'إخراج الكادر',
    description: 'تسجيل ومتابعة عمليات خروج الكوادر',
    icon: DoorOpen,
    gradient: 'from-emerald-500 to-teal-600',
    roles: 'all',
  },
  {
    key: 'violations',
    title: 'سجل المخالفات',
    description: 'تسجيل ومتابعة مخالفات الموظفين',
    icon: Shield,
    gradient: 'from-red-500 to-rose-600',
    roles: ['admin'],
  },
  {
    key: 'reports',
    title: 'التقارير',
    description: 'عرض وتصدير التقارير اليومية والأسبوعية',
    icon: FileText,
    gradient: 'from-amber-500 to-orange-600',
    roles: ['admin', 'driver', 'manager', 'warehouse', 'logistics'],
  },
  {
    key: 'users',
    title: 'إدارة المستخدمين',
    description: 'إضافة وإدارة حسابات المستخدمين والصلاحيات',
    icon: UserCog,
    gradient: 'from-violet-500 to-purple-600',
    roles: ['admin'],
  },
  {
    key: 'settings',
    title: 'الإعدادات',
    description: 'ضبط إعدادات النظام والتفضيلات العامة',
    icon: Settings,
    gradient: 'from-rose-500 to-pink-600',
    roles: ['admin'],
  },
];

export default function Dashboard({ profile, onNavigate }: DashboardProps) {
  const visible = CARDS.filter(
    (c) => c.roles === 'all' || c.roles.includes(profile.role),
  );

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-stone-900 dark:text-white">
          مرحباً بك في Alhasani Home Center Logistics 👋
        </h2>
        <p className="text-stone-500 dark:text-stone-300 mt-1">
          اختر أحد الأقسام للبدء
        </p>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {visible.map((card, i) => (
          <DashboardCard
            key={card.key}
            title={card.title}
            description={card.description}
            icon={card.icon}
            gradient={card.gradient}
            index={i}
            onClick={() => onNavigate(card.key)}
          />
        ))}
      </div>
    </div>
  );
}
