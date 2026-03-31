import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useUserProfile } from './hooks/useUserProfile';
import { supabase } from './lib/supabaseClient';
import { playNotificationSound } from './lib/notificationSound';
import Layout, { type PageKey } from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Vehicles from './pages/Vehicles';
import StaffExit from './pages/StaffExit';
import Violations from './pages/Violations';
import UsersManagement from './pages/UsersManagement';
import MaintenanceDashboard from './pages/MaintenanceDashboard';
import MaintenanceRequests from './pages/MaintenanceRequests';
import ActiveMaintenance from './pages/ActiveMaintenance';
import MaintenanceHistory from './pages/MaintenanceHistory';
import SpareParts from './pages/SpareParts';
import MaintenanceNotifications from './pages/MaintenanceNotifications';
import CrewAttendance from './pages/CrewAttendance';
import CrewStaff from './pages/CrewStaff';
import AttendanceHistory from './pages/AttendanceHistory';
import AttendanceReports from './pages/AttendanceReports';
import ReportsHub from './pages/ReportsHub';
import Bubbles from './pages/Bubbles';
import AttendanceActivityLog from './pages/AttendanceActivityLog';
import { SmartPageProvider } from './smart';

export default function App() {
  const { user, profile, loading, signingOut, signOut } = useUserProfile();

  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return localStorage.getItem('darkMode') === 'true';
    } catch {
      return false;
    }
  });

  /* Dark mode sync */
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    try { localStorage.setItem('darkMode', String(isDarkMode)); } catch { /* noop */ }
  }, [isDarkMode]);

  const role = profile?.role;
  useEffect(() => {
    if (role === 'gate_guard' && activePage === 'dashboard') {
      setActivePage('staff-exit');
    }
    if (role === 'maintenance_manager' && activePage === 'dashboard') {
      setActivePage('maintenance-requests');
    }
  }, [role, activePage]);

  // Audible alert for maintenance manager when a new pending request is created
  useEffect(() => {
    if (role !== 'maintenance_manager') return;
    const channel = supabase
      .channel('maintenance-requests-new')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'maintenance_requests' },
        (payload) => {
          const row = payload.new as { status?: string };
          if (row?.status === 'pending') {
            playNotificationSound();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [role]);

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-stone-950">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          <p className="text-stone-500 dark:text-stone-400 font-medium">جاري التحميل...</p>
        </motion.div>
      </div>
    );
  }

  /* ── Not logged in ── */
  if (!user || !profile) {
    return <LoginPage />;
  }

  /* ── Authenticated ── */

  /* Role-based page guard — redirect to dashboard if unauthorized */
  const maintenancePages: PageKey[] = ['maintenance', 'maintenance-requests', 'active-maintenance', 'maintenance-history', 'spare-parts', 'notifications'];
  const maintenanceManagerPages: PageKey[] = ['maintenance-requests', 'active-maintenance', 'maintenance-history', 'notifications'];
  const attendancePages: PageKey[] = ['crew-attendance', 'crew-staff', 'attendance-history', 'attendance-reports', 'attendance-activity-log'];
  const smartHubPages: PageKey[] = ['reports-hub'];
  const guardedPage = (() => {
    if (activePage === 'users' && role !== 'admin') return 'dashboard';
    if (activePage === 'settings' && role !== 'admin') return 'dashboard';
    if (
      activePage === 'bubbles' &&
      role !== 'admin' &&
      role !== 'manager' &&
      role !== 'logistics' &&
      role !== 'gate_guard'
    ) {
      return 'dashboard';
    }
    if (maintenancePages.includes(activePage) && role !== 'admin' && role !== 'maintenance_manager') return 'dashboard';
    if (smartHubPages.includes(activePage) && role !== 'admin' && role !== 'manager') return 'dashboard';
    if (attendancePages.includes(activePage) && role !== 'admin' && role !== 'manager') return 'dashboard';
    if (role === 'gate_guard' && activePage !== 'dashboard' && activePage !== 'staff-exit' && activePage !== 'bubbles') {
      return 'staff-exit';
    }
    if (role === 'maintenance_manager' && !maintenanceManagerPages.includes(activePage) && activePage !== 'dashboard') return 'maintenance-requests';
    return activePage;
  })();

  const authUser = user!;
  const authProfile = profile!;

  function renderPage() {
    switch (guardedPage) {
      case 'dashboard':
        return <Dashboard profile={authProfile} onNavigate={setActivePage} />;
      case 'reports':
        return <Reports userId={authUser.id} />;
      case 'vehicles':
        return <Vehicles profile={authProfile} />;
      case 'staff-exit':
        return <StaffExit profile={authProfile} userId={authUser.id} />;
      case 'violations':
        return <Violations />;
      case 'users':
        return <UsersManagement />;
      case 'maintenance':
        return <MaintenanceDashboard onNavigate={setActivePage} />;
      case 'maintenance-requests':
        return <MaintenanceRequests profile={authProfile} onNavigate={setActivePage} />;
      case 'active-maintenance':
        return <ActiveMaintenance profile={authProfile} onNavigate={setActivePage} />;
      case 'maintenance-history':
        return <MaintenanceHistory profile={authProfile} />;
      case 'spare-parts':
        return <SpareParts />;
      case 'notifications':
        return <MaintenanceNotifications />;
      case 'crew-attendance':
        return <CrewAttendance profile={authProfile} />;
      case 'crew-staff':
        return <CrewStaff profile={authProfile} />;
      case 'attendance-history':
        return <AttendanceHistory profile={authProfile} />;
      case 'attendance-reports':
        return <AttendanceReports profile={authProfile} />;
      case 'bubbles':
        return <Bubbles profile={authProfile} userId={authUser.id} onOpenReportsHub={() => setActivePage('reports-hub')} />;
      case 'reports-hub':
        return <ReportsHub profile={authProfile} />;
      case 'attendance-activity-log':
        return <AttendanceActivityLog profile={authProfile} />;
      case 'settings':
        return <div className="text-center py-20 text-stone-500">الإعدادات — قيد التطوير</div>;
      default:
        return <Dashboard profile={authProfile} onNavigate={setActivePage} />;
    }
  }

  return (
    <Layout
      profile={profile}
      activePage={activePage}
      onNavigate={setActivePage}
      onSignOut={signOut}
      signingOut={signingOut}
      isDarkMode={isDarkMode}
      onToggleDark={() => setIsDarkMode((prev: boolean) => !prev)}
    >
      <SmartPageProvider pageKey={guardedPage}>{renderPage()}</SmartPageProvider>
    </Layout>
  );
}
