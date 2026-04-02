import { useEffect, useMemo, useState } from 'react';
import type { UserProfile } from '../lib/supabaseClient';
import Layout, { type PageKey } from '../components/Layout';
import { SmartPageProvider } from '../smart';
import { getDepartmentClient, getDepartmentTables } from '../data/supabaseSource';
import { playNotificationSound } from '../lib/notificationSound';
import { resolveWorkspaceGuardedPage } from '../lib/workspacePageGuard';
import InstallationVehicles from './InstallationVehicles';
import InstallationStaffExit from './InstallationStaffExit';
import MaintenanceDashboard from './MaintenanceDashboard';
import MaintenanceRequests from './MaintenanceRequests';
import ActiveMaintenance from './ActiveMaintenance';
import MaintenanceHistory from './MaintenanceHistory';
import SpareParts from './SpareParts';
import MaintenanceNotifications from './MaintenanceNotifications';
import Dashboard from './Dashboard';
import Reports from './Reports';
import Violations from './Violations';
import ReportsHub from './ReportsHub';
import UsersManagement from './UsersManagement';
import CrewAttendance from './CrewAttendance';
import CrewStaff from './CrewStaff';
import AttendanceHistory from './AttendanceHistory';
import AttendanceReports from './AttendanceReports';
import AttendanceActivityLog from './AttendanceActivityLog';

interface InstallationWorkspaceProps {
  profile: UserProfile;
  userId: string;
  onBack: () => void;
  onSignOut: () => void;
  signingOut?: boolean;
  isDarkMode: boolean;
  onToggleDark: () => void;
}

export default function InstallationWorkspace({
  profile,
  userId,
  onBack,
  onSignOut,
  signingOut = false,
  isDarkMode,
  onToggleDark,
}: InstallationWorkspaceProps) {
  const [activePage, setActivePage] = useState<PageKey>('dashboard');

  const role = profile?.role;
  const guardedPage = useMemo(
    () => resolveWorkspaceGuardedPage(activePage, role, { department: 'installation' }),
    [activePage, role],
  );
  useEffect(() => {
    if (role === 'gate_guard' && activePage === 'dashboard') {
      setActivePage('staff-exit');
    }
    if (role === 'maintenance_manager' && activePage === 'dashboard') {
      setActivePage('maintenance-requests');
    }
  }, [role, activePage]);

  useEffect(() => {
    if (role !== 'maintenance_manager') return;
    const supabase = getDepartmentClient('installation');
    const tables = getDepartmentTables('installation');
    const channel = supabase
      .channel('installation-maintenance-requests-insert')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: tables.maintenanceRequests },
        (payload) => {
          const row = payload.new as { status?: string };
          if (row?.status === 'pending') playNotificationSound();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [role]);

  function renderPage() {
    switch (guardedPage) {
      case 'dashboard':
        return <Dashboard profile={profile} onNavigate={setActivePage} department="installation" />;
      case 'vehicles':
        return <InstallationVehicles isDarkMode={isDarkMode} />;
      case 'staff-exit':
        return <InstallationStaffExit profile={profile} userId={userId} />;
      case 'reports':
        return <Reports userId={userId} department="installation" />;
      case 'violations':
        return <Violations department="installation" />;
      case 'reports-hub':
        return <ReportsHub profile={profile} department="installation" />;
      case 'users':
        return <UsersManagement />;
      case 'crew-attendance':
        return <CrewAttendance profile={profile} department="installation" />;
      case 'crew-staff':
        return <CrewStaff profile={profile} department="installation" />;
      case 'attendance-history':
        return <AttendanceHistory profile={profile} department="installation" />;
      case 'attendance-reports':
        return <AttendanceReports profile={profile} department="installation" />;
      case 'attendance-activity-log':
        return <AttendanceActivityLog profile={profile} department="installation" />;
      case 'maintenance':
        return <MaintenanceDashboard department="installation" onNavigate={setActivePage} />;
      case 'maintenance-requests':
        return <MaintenanceRequests department="installation" profile={profile} onNavigate={setActivePage} />;
      case 'active-maintenance':
        return <ActiveMaintenance department="installation" profile={profile} onNavigate={setActivePage} />;
      case 'maintenance-history':
        return <MaintenanceHistory department="installation" profile={profile} />;
      case 'spare-parts':
        return <SpareParts department="installation" />;
      case 'notifications':
        return <MaintenanceNotifications department="installation" />;
      case 'settings':
        return <div className="text-center py-20 text-stone-500">الإعدادات — قيد التطوير</div>;
      default:
        return <Dashboard profile={profile} onNavigate={setActivePage} department="installation" />;
    }
  }

  return (
    <Layout
      profile={profile}
      activePage={guardedPage}
      onNavigate={setActivePage}
      onBackToSections={onBack}
      onSignOut={onSignOut}
      signingOut={signingOut}
      isDarkMode={isDarkMode}
      onToggleDark={onToggleDark}
      department="installation"
    >
      <SmartPageProvider pageKey={guardedPage}>{renderPage()}</SmartPageProvider>
    </Layout>
  );
}
