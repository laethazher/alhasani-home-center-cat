import type { PageKey } from '../components/Layout';
import type { UserRole } from './supabaseClient';
import type { DepartmentCode } from '../data/department';

const maintenancePages: PageKey[] = [
  'maintenance',
  'maintenance-requests',
  'active-maintenance',
  'maintenance-history',
  'spare-parts',
  'notifications',
];

const maintenanceManagerPages: PageKey[] = [
  'maintenance-requests',
  'active-maintenance',
  'maintenance-history',
  'notifications',
];

const attendancePages: PageKey[] = [
  'crew-attendance',
  'crew-staff',
  'attendance-history',
  'attendance-reports',
  'attendance-activity-log',
];

const smartHubPages: PageKey[] = ['reports-hub'];

/**
 * نفس قواعد التجهيز (App.tsx) مع فرع لقسم التركيب: لا يوجد Bubbles، وحارس البوابة يقتصر على لوحة/إخراج الكادر فقط.
 */
export function resolveWorkspaceGuardedPage(
  activePage: PageKey,
  role: UserRole | undefined,
  opts: { department: DepartmentCode },
): PageKey {
  const r = role ?? 'driver';

  if (opts.department === 'operations' && r !== 'admin') {
    return 'dashboard';
  }

  if (r === 'installation_department' && opts.department === 'tajhiz') {
    return 'dashboard';
  }

  if (activePage === 'users' && r !== 'admin') return 'dashboard';
  if (activePage === 'settings' && r !== 'admin') return 'dashboard';

  if (opts.department === 'tajhiz') {
    if (
      activePage === 'bubbles' &&
      r !== 'admin' &&
      r !== 'manager' &&
      r !== 'logistics' &&
      r !== 'gate_guard'
    ) {
      return 'dashboard';
    }
  } else if (activePage === 'bubbles') {
    return 'dashboard';
  }

  const isInstallationDepartmentRole = r === 'installation_department' && opts.department === 'installation';

  if (
    maintenancePages.includes(activePage) &&
    r !== 'admin' &&
    r !== 'maintenance_manager' &&
    !isInstallationDepartmentRole
  ) {
    return 'dashboard';
  }
  if (smartHubPages.includes(activePage) && r !== 'admin' && r !== 'manager' && !isInstallationDepartmentRole) {
    return 'dashboard';
  }
  if (attendancePages.includes(activePage) && r !== 'admin' && r !== 'manager' && !isInstallationDepartmentRole) {
    return 'dashboard';
  }

  if (r === 'gate_guard') {
    if (opts.department === 'installation') {
      if (activePage !== 'dashboard' && activePage !== 'staff-exit') return 'staff-exit';
    } else {
      if (activePage !== 'dashboard' && activePage !== 'staff-exit' && activePage !== 'bubbles') {
        return 'staff-exit';
      }
    }
  }

  if (
    r === 'maintenance_manager' &&
    !maintenanceManagerPages.includes(activePage) &&
    activePage !== 'dashboard'
  ) {
    return 'maintenance-requests';
  }

  return activePage;
}
