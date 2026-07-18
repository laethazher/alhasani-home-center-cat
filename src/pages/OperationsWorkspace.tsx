import { useState } from 'react';
import type { UserProfile } from '../lib/supabaseClient';
import OperationsLayout from '../components/operations/OperationsLayout';
import Reports from './Reports';
import type { OperationsPageKey } from './operations/types';
import OpsDashboard from './operations/OpsDashboard';
import OpsTaskManagement from './operations/OpsTaskManagement';
import OpsFieldOperations from './operations/OpsFieldOperations';
import OpsScheduling from './operations/OpsScheduling';
import OpsIncidents from './operations/OpsIncidents';
import OpsInventory from './operations/OpsInventory';
import OpsReportsAnalytics from './operations/OpsReportsAnalytics';
import DataAnalysisCenter from './operations/DataAnalysisCenter';
import OpsIntegrations from './operations/OpsIntegrations';
import OpsAdminLettersArchive from './operations/OpsAdminLettersArchive';

interface OperationsWorkspaceProps {
  profile: UserProfile;
  userId: string;
  onBack: () => void;
  onSignOut: () => void;
  signingOut?: boolean;
  isDarkMode: boolean;
  onToggleDark: () => void;
}

export default function OperationsWorkspace({
  profile,
  userId,
  onBack,
  onSignOut,
  signingOut = false,
  isDarkMode,
  onToggleDark,
}: OperationsWorkspaceProps) {
  const [activePage, setActivePage] = useState<OperationsPageKey>('ops-dashboard');

  function renderPage() {
    switch (activePage) {
      case 'ops-dashboard':
        return <OpsDashboard onNavigate={setActivePage} />;
      case 'ops-tasks':
        return <OpsTaskManagement />;
      case 'ops-field':
        return <OpsFieldOperations />;
      case 'ops-scheduling':
        return <OpsScheduling />;
      case 'ops-incidents':
        return <OpsIncidents />;
      case 'ops-inventory':
        return <OpsInventory />;
      case 'ops-analytics':
        return <OpsReportsAnalytics />;
      case 'ops-data-analysis':
        return <DataAnalysisCenter />;
      case 'ops-admin-letters':
        return <OpsAdminLettersArchive userId={userId} />;
      case 'ops-integrations':
        return <OpsIntegrations />;
      case 'shared-reports':
        return <Reports userId={userId} department="operations" />;
      default:
        return <OpsDashboard onNavigate={setActivePage} />;
    }
  }

  return (
    <OperationsLayout
      profile={profile}
      activePage={activePage}
      onNavigate={setActivePage}
      onBackToSections={onBack}
      onSignOut={onSignOut}
      signingOut={signingOut}
      isDarkMode={isDarkMode}
      onToggleDark={onToggleDark}
    >
      {renderPage()}
    </OperationsLayout>
  );
}
