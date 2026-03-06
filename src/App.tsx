import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useUserProfile } from './hooks/useUserProfile';
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
      setActivePage('maintenance');
    }
  }, [role, activePage]);

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
  const guardedPage = (() => {
    if (activePage === 'users' && role !== 'admin') return 'dashboard';
    if (activePage === 'settings' && role !== 'admin') return 'dashboard';
    if (maintenancePages.includes(activePage) && role !== 'admin' && role !== 'maintenance_manager') return 'dashboard';
    if (role === 'gate_guard' && activePage !== 'dashboard' && activePage !== 'staff-exit') return 'staff-exit';
    if (role === 'maintenance_manager' && !maintenancePages.includes(activePage) && activePage !== 'dashboard' && activePage !== 'staff-exit') return 'maintenance';
    return activePage;
  })();

  function renderPage() {
    switch (guardedPage) {
      case 'dashboard':
        return <Dashboard profile={profile} onNavigate={setActivePage} />;
      case 'reports':
        return <Reports userId={user.id} />;
      case 'vehicles':
        return <Vehicles profile={profile} />;
      case 'staff-exit':
        return <StaffExit profile={profile} userId={user.id} />;
      case 'violations':
        return <Violations />;
      case 'users':
        return <UsersManagement />;
      case 'maintenance':
        return <MaintenanceDashboard onNavigate={setActivePage} />;
      case 'maintenance-requests':
        return <MaintenanceRequests profile={profile} onNavigate={setActivePage} />;
      case 'active-maintenance':
        return <ActiveMaintenance profile={profile} onNavigate={setActivePage} />;
      case 'maintenance-history':
        return <MaintenanceHistory />;
      case 'spare-parts':
        return <SpareParts />;
      case 'notifications':
        return <MaintenanceNotifications />;
      case 'settings':
        return <div className="text-center py-20 text-stone-500">الإعدادات — قيد التطوير</div>;
      default:
        return <Dashboard profile={profile} onNavigate={setActivePage} />;
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
      onToggleDark={() => setIsDarkMode((p) => !p)}
    >
      {renderPage()}
    </Layout>
  );
}
