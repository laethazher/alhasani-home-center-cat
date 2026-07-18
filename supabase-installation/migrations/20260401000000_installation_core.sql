-- ============================================================
-- Installation Department - Isolated Core Schema
-- ============================================================
-- This schema is designed for a dedicated Supabase project
-- and does not touch Tajhiz production tables.

-- ---------- helpers ----------
create or replace function public.current_role()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'user_role',
    auth.jwt() -> 'raw_app_meta_data' ->> 'user_role',
    'driver'
  );
$$;

create or replace function public.is_admin_like()
returns boolean
language sql
stable
as $$
  select public.current_role() in ('admin', 'manager', 'gate_guard', 'maintenance_manager');
$$;

-- ---------- identities ----------
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'manager', 'gate_guard', 'maintenance_manager', 'driver')),
  department_code text not null default 'installation' check (department_code = 'installation'),
  created_at timestamptz not null default now()
);

create table if not exists public.installation_staff_members (
  id bigint generated always as identity primary key,
  full_name text not null unique,
  role text not null default 'technician' check (role in ('technician', 'crew')),
  city text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- vehicles ----------
create table if not exists public.installation_vehicles (
  id bigint generated always as identity primary key,
  vehicle_number text not null unique,
  vehicle_type text not null check (vehicle_type in ('starex', 'nissan')),
  model text,
  color text,
  year int,
  chassis_number text,
  status text not null default 'available' check (status in ('available', 'maintenance', 'broken', 'reserved')),
  location text,
  responsible_staff_id bigint references public.installation_staff_members(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.installation_vehicle_events (
  id bigint generated always as identity primary key,
  vehicle_id bigint not null references public.installation_vehicles(id) on delete cascade,
  event_type text not null,
  description text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create table if not exists public.installation_vehicle_maintenance (
  id bigint generated always as identity primary key,
  vehicle_id bigint not null references public.installation_vehicles(id) on delete cascade,
  maintenance_type text not null,
  description text,
  cost numeric(12,2) not null default 0,
  odometer_at int,
  performed_at date not null default current_date,
  next_maintenance_date date,
  next_maintenance_km int,
  performed_by text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- exits ----------
create table if not exists public.installation_exit_requests (
  id bigint generated always as identity primary key,
  vehicle_id bigint references public.installation_vehicles(id) on delete set null,
  vehicle_number text,
  vehicle_type text check (vehicle_type in ('starex', 'nissan')),
  location_snapshot text,
  technician_ids bigint[] not null default '{}',
  technician_names text[] not null default '{}',
  responsible_staff_id bigint references public.installation_staff_members(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'exited', 'pending_issue', 'approved_override')),
  notes text,
  exit_reason text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  gate_guard_id uuid references auth.users(id) on delete set null,
  exited_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.installation_exit_requests add column if not exists driver_id bigint references public.installation_staff_members(id) on delete set null;
alter table public.installation_exit_requests add column if not exists driver_name text;
alter table public.installation_exit_requests add column if not exists assistant_ids bigint[] not null default '{}';
alter table public.installation_exit_requests add column if not exists assistant_names text[] not null default '{}';
alter table public.installation_exit_requests add column if not exists assistant_returns jsonb;
alter table public.installation_exit_requests add column if not exists exit_type text not null default 'permanent' check (exit_type in ('permanent', 'temporary'));
alter table public.installation_exit_requests add column if not exists exit_duration_minutes int;
alter table public.installation_exit_requests add column if not exists vehicle_plate text;
alter table public.installation_exit_requests add column if not exists vehicle_cbm numeric(12,2);
alter table public.installation_exit_requests add column if not exists track_driver_loading_time boolean not null default false;
alter table public.installation_exit_requests add column if not exists loading_minutes_from_shift_start int;
alter table public.installation_exit_requests add column if not exists loading_delay_minutes int;
alter table public.installation_exit_requests add column if not exists loading_is_delay boolean;
alter table public.installation_exit_requests add column if not exists loading_verified boolean;
alter table public.installation_exit_requests add column if not exists loading_issue_reason text;

create index if not exists idx_installation_exit_requests_status on public.installation_exit_requests(status);
create index if not exists idx_installation_exit_requests_vehicle on public.installation_exit_requests(vehicle_id);

-- ---------- maintenance ----------
create table if not exists public.installation_maintenance_requests (
  id bigint generated always as identity primary key,
  vehicle_id bigint not null references public.installation_vehicles(id) on delete cascade,
  staff_id bigint references public.installation_staff_members(id) on delete set null,
  maintenance_type text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'in_progress', 'completed')),
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.installation_maintenance_requests add column if not exists driver_id bigint references public.installation_staff_members(id) on delete set null;
update public.installation_maintenance_requests
set driver_id = staff_id
where driver_id is null and staff_id is not null;

create table if not exists public.installation_maintenance_records (
  id bigint generated always as identity primary key,
  request_id bigint references public.installation_maintenance_requests(id) on delete set null,
  vehicle_id bigint not null references public.installation_vehicles(id) on delete cascade,
  maintenance_type text,
  fault_description text,
  work_done text,
  inspection_only boolean not null default false,
  parts_replaced text,
  technician_name text,
  cost numeric(12,2) not null default 0,
  duration_minutes int,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.installation_maintenance_images (
  id bigint generated always as identity primary key,
  request_id bigint references public.installation_maintenance_requests(id) on delete cascade,
  record_id bigint references public.installation_maintenance_records(id) on delete cascade,
  image_url text not null,
  image_type text not null check (image_type in ('before', 'during', 'after', 'invoice', 'issue')),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.installation_spare_parts (
  id bigint generated always as identity primary key,
  name text not null,
  part_number text,
  supplier text,
  price numeric(12,2) not null default 0,
  quantity int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.installation_spare_part_usage (
  id bigint generated always as identity primary key,
  record_id bigint not null references public.installation_maintenance_records(id) on delete cascade,
  part_id bigint not null references public.installation_spare_parts(id) on delete restrict,
  quantity_used int not null,
  unit_cost numeric(12,2),
  created_at timestamptz not null default now()
);

create table if not exists public.installation_periodic_maintenance (
  id bigint generated always as identity primary key,
  vehicle_id bigint not null references public.installation_vehicles(id) on delete cascade,
  maintenance_type text not null,
  last_performed_at timestamptz,
  next_due_date date,
  next_due_km int,
  interval_days int,
  interval_km int,
  status text not null default 'good' check (status in ('good', 'approaching', 'overdue')),
  created_at timestamptz not null default now()
);
alter table public.installation_periodic_maintenance add column if not exists next_due_km int;
alter table public.installation_periodic_maintenance add column if not exists interval_km int;

create table if not exists public.installation_driver_issue_reports (
  id bigint generated always as identity primary key,
  vehicle_id bigint not null references public.installation_vehicles(id) on delete cascade,
  staff_id bigint references public.installation_staff_members(id) on delete set null,
  description text not null,
  images text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'converted')),
  created_at timestamptz not null default now()
);
alter table public.installation_driver_issue_reports add column if not exists driver_id bigint references public.installation_staff_members(id) on delete set null;
update public.installation_driver_issue_reports
set driver_id = staff_id
where driver_id is null and staff_id is not null;

create table if not exists public.installation_maintenance_notifications (
  id bigint generated always as identity primary key,
  vehicle_id bigint references public.installation_vehicles(id) on delete set null,
  request_id bigint references public.installation_maintenance_requests(id) on delete set null,
  notification_type text not null,
  title text not null,
  message text,
  source_department text not null default 'installation' check (source_department = 'installation'),
  created_by uuid references auth.users(id) on delete set null,
  target_role text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- attendance ----------
create table if not exists public.installation_attendance (
  id bigint generated always as identity primary key,
  staff_id bigint not null references public.installation_staff_members(id) on delete cascade,
  attendance_date date not null,
  attendance_type text not null check (attendance_type in ('present', 'late', 'absent', 'full_leave', 'time_leave')),
  check_in_time time,
  check_out_time time,
  notes text,
  vehicle_id bigint references public.installation_vehicles(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(staff_id, attendance_date)
);

create table if not exists public.installation_attendance_archive (
  id bigint generated always as identity primary key,
  staff_id bigint not null references public.installation_staff_members(id) on delete cascade,
  attendance_date date not null,
  attendance_type text not null check (attendance_type in ('present', 'late', 'absent', 'full_leave', 'time_leave')),
  check_in_time time,
  check_out_time time,
  notes text,
  vehicle_id bigint references public.installation_vehicles(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  archived_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz not null default now()
);

create table if not exists public.installation_attendance_activity_log (
  id bigint generated always as identity primary key,
  action_type text not null check (action_type in ('add', 'edit', 'archive', 'export')),
  entity_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- violations & reports ----------
create table if not exists public.installation_violations (
  id bigint generated always as identity primary key,
  staff_id bigint references public.installation_staff_members(id) on delete set null,
  violation_type text not null,
  violation_reason text not null,
  violation_date date not null default current_date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.installation_reports (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  vehicle_id bigint references public.installation_vehicles(id) on delete set null,
  vehicle_number text,
  vehicle_type text check (vehicle_type in ('starex', 'nissan')),
  report_type text not null default 'inventory',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- flexible inventory (supports both departments) ----------
create table if not exists public.inventory_item_templates (
  id bigint generated always as identity primary key,
  department_code text not null check (department_code in ('tajhiz', 'installation')),
  category text not null default 'tools',
  item_name text not null,
  required_quantity int not null default 1,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_inventory_item_template
on public.inventory_item_templates(department_code, category, item_name);

-- ---------- unified gate notification contract ----------
create table if not exists public.gate_notifications (
  id bigint generated always as identity primary key,
  source_department text not null check (source_department in ('tajhiz', 'installation')),
  source_module text not null,
  request_ref text not null,
  title text not null,
  message text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  target_role text not null default 'gate_guard',
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_gate_notifications_department on public.gate_notifications(source_department);
create index if not exists idx_gate_notifications_unread on public.gate_notifications(is_read);

create index if not exists idx_installation_veh_maint_vehicle on public.installation_vehicle_maintenance(vehicle_id);
create index if not exists idx_installation_maint_req_vehicle on public.installation_maintenance_requests(vehicle_id);
create index if not exists idx_installation_maint_req_status on public.installation_maintenance_requests(status);
create index if not exists idx_installation_attendance_date on public.installation_attendance(attendance_date);
create index if not exists idx_installation_attendance_archive_date on public.installation_attendance_archive(attendance_date);

-- ---------- triggers ----------
create or replace function public.installation_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_installation_vehicles_updated on public.installation_vehicles;
create trigger trg_installation_vehicles_updated
before update on public.installation_vehicles
for each row execute function public.installation_set_updated_at();

drop trigger if exists trg_installation_attendance_updated on public.installation_attendance;
create trigger trg_installation_attendance_updated
before update on public.installation_attendance
for each row execute function public.installation_set_updated_at();

-- ---------- rpc ----------
create or replace function public.installation_archive_attendance_day(p_day date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  moved_count int := 0;
begin
  if public.current_role() not in ('admin', 'manager') then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  insert into public.installation_attendance_archive (
    staff_id, attendance_date, attendance_type, check_in_time, check_out_time,
    notes, vehicle_id, created_by, archived_by, archived_at
  )
  select
    staff_id, attendance_date, attendance_type, check_in_time, check_out_time,
    notes, vehicle_id, created_by, auth.uid(), now()
  from public.installation_attendance
  where attendance_date = p_day;

  get diagnostics moved_count = row_count;

  delete from public.installation_attendance where attendance_date = p_day;

  return jsonb_build_object('success', true, 'archived_count', moved_count, 'day', p_day);
exception
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

drop function if exists public.installation_finish_maintenance(
  bigint, text, text, text, boolean, text, text, numeric, int, text
);

create or replace function public.installation_finish_maintenance(
  p_request_id bigint,
  p_maintenance_type text,
  p_fault_description text default null,
  p_work_done text default null,
  p_inspection_only boolean default false,
  p_parts_replaced text default null,
  p_technician_name text default null,
  p_cost numeric default 0,
  p_duration_minutes int default null,
  p_notes text default null,
  p_spare_parts jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.installation_maintenance_requests%rowtype;
  v_record_id bigint;
  v_spare jsonb;
  v_part_id bigint;
  v_qty int;
  v_unit_cost numeric;
  v_part_quantity int;
begin
  if public.current_role() not in ('admin', 'maintenance_manager') then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  select * into v_request
  from public.installation_maintenance_requests
  where id = p_request_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'request_not_found');
  end if;

  if v_request.status <> 'in_progress' then
    return jsonb_build_object('success', false, 'error', 'request_not_in_progress');
  end if;

  insert into public.installation_maintenance_records (
    request_id, vehicle_id, maintenance_type, fault_description, work_done,
    inspection_only, parts_replaced, technician_name, cost, duration_minutes, notes
  ) values (
    p_request_id, v_request.vehicle_id, p_maintenance_type, p_fault_description, p_work_done,
    p_inspection_only, p_parts_replaced, p_technician_name, coalesce(p_cost, 0), p_duration_minutes, p_notes
  )
  returning id into v_record_id;

  for v_spare in select * from jsonb_array_elements(coalesce(p_spare_parts, '[]'::jsonb))
  loop
    v_part_id := (v_spare->>'part_id')::bigint;
    v_qty := greatest(1, coalesce((v_spare->>'quantity')::int, 1));
    if v_part_id is null then
      continue;
    end if;

    select quantity, price
    into v_part_quantity, v_unit_cost
    from public.installation_spare_parts
    where id = v_part_id;

    if found and coalesce(v_part_quantity, 0) >= v_qty then
      insert into public.installation_spare_part_usage (record_id, part_id, quantity_used, unit_cost)
      values (v_record_id, v_part_id, v_qty, v_unit_cost);

      update public.installation_spare_parts
      set quantity = quantity - v_qty
      where id = v_part_id;
    end if;
  end loop;

  update public.installation_maintenance_requests
  set status = 'completed', finished_at = now()
  where id = p_request_id;

  update public.installation_vehicles
  set status = 'available'
  where id = v_request.vehicle_id;

  insert into public.installation_vehicle_events (vehicle_id, event_type, description, old_value, new_value)
  values (
    v_request.vehicle_id,
    'status_changed',
    'صيانة مكتملة: ' || coalesce(p_maintenance_type, 'صيانة'),
    'maintenance',
    'available'
  );

  insert into public.installation_maintenance_notifications (
    vehicle_id, request_id, notification_type, title, message, source_department, target_role
  ) values (
    v_request.vehicle_id,
    p_request_id,
    'maintenance_completed',
    'صيانة مكتملة',
    'تم إنهاء صيانة المركبة بنجاح',
    'installation',
    'maintenance_manager'
  );

  update public.installation_maintenance_images
  set record_id = v_record_id
  where request_id = p_request_id;

  return jsonb_build_object('success', true, 'record_id', v_record_id);
exception
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

create or replace function public.installation_delete_maintenance_records(p_record_ids bigint[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_req_ids bigint[] := '{}';
begin
  if public.current_role() <> 'admin' then
    return jsonb_build_object('success', false, 'error', 'admin_only');
  end if;

  if p_record_ids is null or array_length(p_record_ids, 1) is null then
    return jsonb_build_object('success', false, 'error', 'no_ids');
  end if;

  for v_rec in
    select id, vehicle_id, request_id, created_at
    from public.installation_maintenance_records
    where id = any(p_record_ids)
  loop
    if v_rec.request_id is not null then
      v_req_ids := array_append(v_req_ids, v_rec.request_id);
    end if;

    delete from public.installation_vehicle_events
    where vehicle_id = v_rec.vehicle_id
      and event_type = 'status_changed'
      and description like 'صيانة مكتملة%'
      and created_at >= v_rec.created_at - interval '2 seconds'
      and created_at <= v_rec.created_at + interval '2 seconds';

    delete from public.installation_maintenance_notifications
    where vehicle_id = v_rec.vehicle_id
      and notification_type = 'maintenance_completed'
      and created_at >= v_rec.created_at - interval '2 seconds'
      and created_at <= v_rec.created_at + interval '2 seconds';
  end loop;

  if array_length(v_req_ids, 1) > 0 then
    delete from public.installation_maintenance_requests where id = any(v_req_ids);
  end if;

  delete from public.installation_maintenance_records
  where id = any(p_record_ids)
    and request_id is null;

  return jsonb_build_object('success', true);
exception
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

create or replace function public.installation_delete_maintenance_requests(p_request_ids bigint[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_ids bigint[];
  v_result jsonb;
begin
  if public.current_role() <> 'admin' then
    return jsonb_build_object('success', false, 'error', 'admin_only');
  end if;

  if p_request_ids is null or array_length(p_request_ids, 1) is null then
    return jsonb_build_object('success', false, 'error', 'no_ids');
  end if;

  select coalesce(array_agg(id), '{}')
  into v_record_ids
  from public.installation_maintenance_records
  where request_id = any(p_request_ids);

  if v_record_ids is not null and array_length(v_record_ids, 1) > 0 then
    v_result := public.installation_delete_maintenance_records(v_record_ids);
    if coalesce((v_result->>'success')::boolean, false) = false then
      return v_result;
    end if;
  end if;

  delete from public.installation_maintenance_requests where id = any(p_request_ids);
  return jsonb_build_object('success', true);
exception
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.installation_finish_maintenance(
  bigint, text, text, text, boolean, text, text, numeric, int, text, jsonb
) to authenticated;
grant execute on function public.installation_delete_maintenance_records(bigint[]) to authenticated;
grant execute on function public.installation_delete_maintenance_requests(bigint[]) to authenticated;

-- ---------- storage ----------
insert into storage.buckets (id, name, public)
values ('installation-maintenance-images', 'installation-maintenance-images', true)
on conflict (id) do nothing;

drop policy if exists "installation_maint_images_upload" on storage.objects;
create policy "installation_maint_images_upload" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'installation-maintenance-images'
  and public.current_role() in ('admin', 'maintenance_manager')
);

drop policy if exists "installation_maint_images_read_auth" on storage.objects;
create policy "installation_maint_images_read_auth" on storage.objects
for select to authenticated
using (bucket_id = 'installation-maintenance-images');

-- ---------- rls ----------
alter table public.user_profiles enable row level security;
alter table public.installation_staff_members enable row level security;
alter table public.installation_vehicles enable row level security;
alter table public.installation_vehicle_events enable row level security;
alter table public.installation_exit_requests enable row level security;
alter table public.installation_maintenance_requests enable row level security;
alter table public.installation_maintenance_records enable row level security;
alter table public.installation_maintenance_images enable row level security;
alter table public.installation_spare_parts enable row level security;
alter table public.installation_spare_part_usage enable row level security;
alter table public.installation_periodic_maintenance enable row level security;
alter table public.installation_maintenance_notifications enable row level security;
alter table public.installation_vehicle_maintenance enable row level security;
alter table public.installation_driver_issue_reports enable row level security;
alter table public.installation_attendance enable row level security;
alter table public.installation_attendance_archive enable row level security;
alter table public.installation_attendance_activity_log enable row level security;
alter table public.installation_violations enable row level security;
alter table public.installation_reports enable row level security;
alter table public.inventory_item_templates enable row level security;
alter table public.gate_notifications enable row level security;

drop policy if exists "read_all_installation_staff" on public.installation_staff_members;
create policy "read_all_installation_staff"
on public.installation_staff_members for select
using (auth.uid() is not null);

drop policy if exists "admin_write_installation_staff" on public.installation_staff_members;
create policy "admin_write_installation_staff"
on public.installation_staff_members for all
using (public.is_admin_like())
with check (public.is_admin_like());

drop policy if exists "read_all_installation_vehicles" on public.installation_vehicles;
create policy "read_all_installation_vehicles"
on public.installation_vehicles for select
using (auth.uid() is not null);

drop policy if exists "admin_write_installation_vehicles" on public.installation_vehicles;
create policy "admin_write_installation_vehicles"
on public.installation_vehicles for all
using (public.is_admin_like())
with check (public.is_admin_like());

drop policy if exists "read_all_installation_exit_requests" on public.installation_exit_requests;
create policy "read_all_installation_exit_requests"
on public.installation_exit_requests for select
using (auth.uid() is not null);

drop policy if exists "insert_installation_exit_requests" on public.installation_exit_requests;
create policy "insert_installation_exit_requests"
on public.installation_exit_requests for insert
with check (public.current_role() in ('admin', 'manager', 'gate_guard'));

drop policy if exists "update_installation_exit_requests" on public.installation_exit_requests;
create policy "update_installation_exit_requests"
on public.installation_exit_requests for update
using (public.current_role() in ('admin', 'manager', 'gate_guard'))
with check (public.current_role() in ('admin', 'manager', 'gate_guard'));

drop policy if exists "select_maintenance_tables" on public.installation_maintenance_requests;
create policy "select_maintenance_tables"
on public.installation_maintenance_requests for select
using (auth.uid() is not null);

drop policy if exists "write_maintenance_tables" on public.installation_maintenance_requests;
create policy "write_maintenance_tables"
on public.installation_maintenance_requests for all
using (public.current_role() in ('admin', 'maintenance_manager', 'manager'))
with check (public.current_role() in ('admin', 'maintenance_manager', 'manager'));

drop policy if exists "select_installation_attendance" on public.installation_attendance;
create policy "select_installation_attendance"
on public.installation_attendance for select
using (auth.uid() is not null);

drop policy if exists "write_installation_attendance" on public.installation_attendance;
create policy "write_installation_attendance"
on public.installation_attendance for all
using (public.current_role() in ('admin', 'manager'))
with check (public.current_role() in ('admin', 'manager'));

drop policy if exists "read_gate_notifications" on public.gate_notifications;
create policy "read_gate_notifications"
on public.gate_notifications for select
using (public.current_role() in ('gate_guard', 'admin', 'manager'));

drop policy if exists "write_gate_notifications" on public.gate_notifications;
create policy "write_gate_notifications"
on public.gate_notifications for all
using (public.current_role() in ('admin', 'manager', 'gate_guard'))
with check (public.current_role() in ('admin', 'manager', 'gate_guard'));

-- Generic read/write policies for remaining operational tables.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'installation_vehicle_events',
    'installation_maintenance_records',
    'installation_maintenance_images',
    'installation_spare_parts',
    'installation_spare_part_usage',
    'installation_periodic_maintenance',
    'installation_maintenance_notifications',
    'installation_vehicle_maintenance',
    'installation_driver_issue_reports',
    'installation_attendance_archive',
    'installation_attendance_activity_log',
    'installation_violations',
    'installation_reports',
    'inventory_item_templates',
    'user_profiles'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'select_' || tbl, tbl);
    execute format('create policy %I on public.%I for select using (auth.uid() is not null)', 'select_' || tbl, tbl);

    execute format('drop policy if exists %I on public.%I', 'write_' || tbl, tbl);
    execute format(
      'create policy %I on public.%I for all using (public.is_admin_like()) with check (public.is_admin_like())',
      'write_' || tbl,
      tbl
    );
  end loop;
end
$$;
