import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useUserProfile } from './hooks/useUserProfile';
import { supabase } from './lib/supabaseClient';
import { playNotificationSound } from './lib/notificationSound';
import Layout, { type PageKey } from './components/Layout';
import LoginPage from './pages/LoginPage';
import SystemHome from './pages/SystemHome';
import InstallationWorkspace from './pages/InstallationWorkspace';
import GateGuardWorkspace from './pages/GateGuardWorkspace';
import OperationsWorkspace from './pages/OperationsWorkspace';
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
import { resolveWorkspaceGuardedPage } from './lib/workspacePageGuard';
import {
  INSPECTION_DEEPLINK_STORAGE_KEY,
  parseInspectionDeepLink,
} from './lib/inspectionIntelligence/deeplink';

export default function App() {
  const { user, profile, loading, signingOut, signOut } = useUserProfile();
  const [systemArea, setSystemArea] = useState<'tajhiz' | 'installation' | 'operations' | 'gate' | null>(null);
  const [reportsInitialInspectionVehicleId, setReportsInitialInspectionVehicleId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!user) setSystemArea(null);
  }, [user]);

  useEffect(() => {
    const { inspect, department, vehicleId } = parseInspectionDeepLink(window.location.search);
    if (!inspect || !department || !vehicleId) return;
    try {
      sessionStorage.setItem(
        INSPECTION_DEEPLINK_STORAGE_KEY,
        JSON.stringify({ department, vehicleId }),
      );
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('inspect');
    url.searchParams.delete('dept');
    url.searchParams.delete('vehicleId');
    const nextSearch = url.searchParams.toString();
    const path = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
    window.history.replaceState({}, '', path || url.pathname);
  }, []);

  useEffect(() => {
    if (systemArea !== 'tajhiz') return;
    try {
      const raw = sessionStorage.getItem(INSPECTION_DEEPLINK_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { department?: string; vehicleId?: string };
      if (parsed.department !== 'tajhiz' || !parsed.vehicleId) return;
      sessionStorage.removeItem(INSPECTION_DEEPLINK_STORAGE_KEY);
      setReportsInitialInspectionVehicleId(String(parsed.vehicleId));
      setActivePage('reports');
    } catch {
      /* ignore */
    }
  }, [systemArea]);

  const role = profile?.role;
  useEffect(() => {
    if (role === 'gate_guard' && activePage === 'dashboard') {
      setActivePage('staff-exit');
    }
    if (role === 'maintenance_manager' && activePage === 'dashboard') {
      setActivePage('maintenance-requests');
    }
  }, [role, activePage]);

  const handleSelectTajhiz = () => {
    if (role === 'installation_department') {
      alert('ليس من صلاحياتك الدخول إلى قسم التجهيز. يمكنك الدخول إلى قسم التركيب فقط.');
      return;
    }
    setSystemArea('tajhiz');
  };

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

  /* يجب أن تبقى كل الـ hooks فوق أي return مبكر — وإلا يحدث خطأ “more hooks” وشاشة بيضاء عند دخول التجهيز */
  const guardedPage = useMemo(
    () => resolveWorkspaceGuardedPage(activePage, role, { department: 'tajhiz' }),
    [activePage, role],
  );

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

  if (!systemArea) {
    return (
      <SystemHome
        profileName={profile.full_name}
        isDarkMode={isDarkMode}
        isGateGuard={role === 'gate_guard'}
        onToggleDark={() => setIsDarkMode((prev: boolean) => !prev)}
        onSelectTajhiz={handleSelectTajhiz}
        onSelectInstallation={() => setSystemArea('installation')}
        onSelectOperations={() => {
          if (role !== 'admin') {
            alert('ليس من صلاحياتك الدخول إلى قسم العمليات.');
            return;
          }
          setSystemArea('operations');
        }}
        onSelectGate={() => setSystemArea('gate')}
        onSignOut={signOut}
        signingOut={signingOut}
      />
    );
  }

  if (systemArea === 'gate') {
    return (
      <GateGuardWorkspace
        profile={profile}
        userId={user.id}
        onBack={() => setSystemArea(null)}
        onSignOut={signOut}
        signingOut={signingOut}
        isDarkMode={isDarkMode}
      />
    );
  }

  if (systemArea === 'installation') {
    return (
      <InstallationWorkspace
        profile={profile}
        userId={user.id}
        onBack={() => setSystemArea(null)}
        onSignOut={signOut}
        signingOut={signingOut}
        isDarkMode={isDarkMode}
        onToggleDark={() => setIsDarkMode((prev: boolean) => !prev)}
      />
    );
  }

  if (systemArea === 'operations') {
    if (role !== 'admin') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-stone-950">
          <p className="text-stone-500 dark:text-stone-300">ليس من صلاحياتك الدخول إلى قسم العمليات.</p>
        </div>
      );
    }
    return (
      <OperationsWorkspace
        profile={profile}
        onBack={() => setSystemArea(null)}
        onSignOut={signOut}
        signingOut={signingOut}
      />
    );
  }

  /* ── Authenticated (قسم التجهيز) ── */

  const authUser = user!;
  const authProfile = profile!;

  function renderPage() {
    switch (guardedPage) {
      case 'dashboard':
        return <Dashboard profile={authProfile} onNavigate={setActivePage} />;
      case 'reports':
        return (
          <Reports
            userId={authUser.id}
            initialInspectionVehicleId={reportsInitialInspectionVehicleId}
            onConsumedInitialInspectionVehicle={() => setReportsInitialInspectionVehicleId(null)}
          />
        );
      case 'vehicles':
        return <Vehicles profile={authProfile} />;
      case 'staff-exit':
        return (
          <StaffExit
            profile={authProfile}
            userId={authUser.id}
            onOpenReports={() => setActivePage('reports')}
          />
        );
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
        return <SpareParts profile={authProfile} />;
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
      activePage={guardedPage}
      onNavigate={setActivePage}
      onBackToSections={() => setSystemArea(null)}
      onSignOut={signOut}
      signingOut={signingOut}
      isDarkMode={isDarkMode}
      onToggleDark={() => setIsDarkMode((prev: boolean) => !prev)}
    >
      <SmartPageProvider pageKey={guardedPage}>{renderPage()}</SmartPageProvider>
    </Layout>
  );
}
