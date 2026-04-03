-- مطابقة installation_maintenance_requests لجدول maintenance_requests (تجهيز):
-- admin_notes + images[] لدعم نموذج MaintenanceRequests.tsx دون أخطاء schema cache.

alter table public.installation_maintenance_requests
  add column if not exists admin_notes text;

alter table public.installation_maintenance_requests
  add column if not exists images text[] not null default '{}';
