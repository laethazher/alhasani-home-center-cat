-- إن وُجدت جداول التركيب في نفس المشروع (دمج المخططات)، أضف الأعمدة الناقصة.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'installation_maintenance_requests'
  ) then
    alter table public.installation_maintenance_requests
      add column if not exists admin_notes text;
    alter table public.installation_maintenance_requests
      add column if not exists images text[] not null default '{}';
  end if;
end $$;
