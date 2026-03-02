import React from 'react';
import { Truck, FileText, DoorOpen, UserCog, Settings } from 'lucide-react';
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
    title: 'جرد المركبات',
    description: 'إدارة ومتابعة حالة جميع المركبات والمعدات',
    icon: Truck,
    gradient: 'from-blue-500 to-indigo-600',
    roles: 'all',
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
    key: 'reports',
    title: 'التقارير',
    description: 'عرض وتصدير التقارير اليومية والأسبوعية',
    icon: FileText,
    gradient: 'from-amber-500 to-orange-600',
    roles: 'all',
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
        <h2 className="text-2xl md:text-3xl font-extrabold">
          مرحباً بك في Alhasani Home Center Logistics 👋
        </h2>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
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
