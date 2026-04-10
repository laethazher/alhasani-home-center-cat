import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Bell, CheckCheck, CircleDot, DoorOpen, LogOut, Shield } from 'lucide-react';
import { getDepartmentClient } from '../data/supabaseSource';
import type { UserProfile } from '../lib/supabaseClient';
import StaffExit from './StaffExit';
import InstallationStaffExit from './InstallationStaffExit';
import Bubbles from './Bubbles';

interface GateNotificationRow {
  id: number;
  source_department: 'tajhiz' | 'installation';
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

interface GateGuardWorkspaceProps {
  profile: UserProfile;
  userId: string;
  onBack: () => void;
  onSignOut: () => void;
  signingOut?: boolean;
  isDarkMode: boolean;
}

export default function GateGuardWorkspace({
  profile,
  userId,
  onBack,
  onSignOut,
  signingOut = false,
  isDarkMode,
}: GateGuardWorkspaceProps) {
  const [tab, setTab] = useState<'tajhiz' | 'installation'>('tajhiz');
  /** داخل التجهيز: إخراج الكادر أو متابعة الببلز (نفس صلاحيات Layout دون الاعتماد على القائمة الجانبية) */
  const [tajhizTool, setTajhizTool] = useState<'staff-exit' | 'bubbles'>('staff-exit');
  const [notifications, setNotifications] = useState<GateNotificationRow[]>([]);
  const supabase = getDepartmentClient('installation');

  useEffect(() => {
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('gate_notifications')
        .select('id, source_department, title, message, is_read, created_at')
        .eq('target_role', 'gate_guard')
        .order('created_at', { ascending: false })
        .limit(30);
      if (data) setNotifications(data as GateNotificationRow[]);
    };
    fetchNotifications();
    const id = setInterval(fetchNotifications, 10000);
    return () => clearInterval(id);
  }, [supabase]);

  const unread = useMemo(() => notifications.filter((n) => !n.is_read), [notifications]);
  const unreadTajhiz = unread.filter((n) => n.source_department === 'tajhiz').length;
  const unreadInstallation = unread.filter((n) => n.source_department === 'installation').length;

  async function markAllRead() {
    await supabase
      .from('gate_notifications')
      .update({ is_read: true })
      .eq('target_role', 'gate_guard')
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  return (
    <div className="min-h-screen" dir="rtl">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border p-4 md:p-5"
          style={{
            background: isDarkMode ? 'rgba(13,20,31,0.9)' : '#fff',
            borderColor: isDarkMode ? 'rgba(244,114,182,0.25)' : 'rgba(244,114,182,0.2)',
          }}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-pink-600/10 border border-pink-500/20">
                <Shield className="w-5 h-5 text-pink-500" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black" style={{ color: isDarkMode ? '#e2e8f0' : '#0f172a' }}>
                  بوابة الحارس الموحدة
                </h2>
                <p className="text-xs md:text-sm" style={{ color: isDarkMode ? '#64748b' : '#64748b' }}>
                  {profile.full_name} — {profile.role}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onBack} className="h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 border border-blue-300/40 text-blue-600">
                <ArrowRight className="w-4 h-4" />
                الرجوع للأقسام
              </button>
              <button onClick={onSignOut} disabled={signingOut} className="h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-300/40 text-red-600">
                <LogOut className="w-4 h-4" />
                تسجيل الخروج
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('tajhiz')}
              className={`px-4 h-9 rounded-xl text-sm font-bold border ${tab === 'tajhiz' ? 'bg-blue-600 text-white border-blue-600' : 'border-stone-300 text-stone-600'}`}
            >
              التجهيز {unreadTajhiz > 0 ? `(${unreadTajhiz})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setTab('installation')}
              className={`px-4 h-9 rounded-xl text-sm font-bold border ${tab === 'installation' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-stone-300 text-stone-600'}`}
            >
              التركيب {unreadInstallation > 0 ? `(${unreadInstallation})` : ''}
            </button>
            <button onClick={markAllRead} className="mr-auto h-9 px-3 rounded-xl text-xs font-bold border border-stone-300 text-stone-600 flex items-center gap-1.5">
              <CheckCheck className="w-4 h-4" />
              تعليم الكل كمقروء
            </button>
          </div>

          {unread.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                <Bell className="w-4 h-4" />
                إشعارات غير مقروءة: {unread.length}
              </div>
            </div>
          )}
        </motion.div>

        {tab === 'tajhiz' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-2 rounded-2xl border p-3"
            style={{
              background: isDarkMode ? 'rgba(13,20,31,0.85)' : '#f8fafc',
              borderColor: isDarkMode ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.35)',
            }}
          >
            <button
              type="button"
              onClick={() => setTajhizTool('staff-exit')}
              className={`inline-flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold border transition-colors ${
                tajhizTool === 'staff-exit'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'border-stone-300 text-stone-600 dark:border-stone-600 dark:text-stone-300 bg-white dark:bg-stone-900'
              }`}
            >
              <DoorOpen className="w-4 h-4 shrink-0" />
              إخراج الكادر
            </button>
            <button
              type="button"
              onClick={() => setTajhizTool('bubbles')}
              className={`inline-flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold border transition-colors ${
                tajhizTool === 'bubbles'
                  ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                  : 'border-stone-300 text-stone-600 dark:border-stone-600 dark:text-stone-300 bg-white dark:bg-stone-900'
              }`}
            >
              <CircleDot className="w-4 h-4 shrink-0" />
              الببلز — إرجاع وتسجيل المشاكل
            </button>
          </motion.div>
        )}

        <div>
          {tab === 'tajhiz' && tajhizTool === 'staff-exit' && (
            <StaffExit profile={profile} userId={userId} unifiedGatePortal />
          )}
          {tab === 'tajhiz' && tajhizTool === 'bubbles' && <Bubbles profile={profile} userId={userId} />}
          {tab === 'installation' && (
            <InstallationStaffExit profile={profile} userId={userId} unifiedGatePortal />
          )}
        </div>
      </div>
    </div>
  );
}
