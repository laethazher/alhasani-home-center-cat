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

  /* Gate guard defaults to staff-exit page */
  const role = profile?.role;
  useEffect(() => {
    if (role === 'gate_guard' && activePage === 'dashboard') {
      setActivePage('staff-exit');
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
  const guardedPage = (() => {
    if (activePage === 'users' && role !== 'admin') return 'dashboard';
    if (activePage === 'settings' && role !== 'admin') return 'dashboard';
    // Gate guard can only access staff-exit and dashboard
    if (role === 'gate_guard' && activePage !== 'dashboard' && activePage !== 'staff-exit') return 'staff-exit';
    return activePage;
  })();

  function renderPage() {
    switch (guardedPage) {
      case 'dashboard':
        return <Dashboard profile={profile} onNavigate={setActivePage} />;
      case 'reports':
        return <Reports userId={user.id} />;
      case 'vehicles':
        return <Vehicles />;
      case 'staff-exit':
        return <StaffExit profile={profile} userId={user.id} />;
      case 'violations':
        return <Violations />;
      case 'users':
        return <UsersManagement />;
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
