-- ============================================================
-- Installation Department - Seed Data
-- ============================================================
-- This seed is safe to run multiple times.

insert into public.installation_staff_members (full_name, role, city, is_active)
values
  ('فني تركيب 01', 'technician', 'بغداد', true),
  ('فني تركيب 02', 'technician', 'بغداد', true),
  ('فني تركيب 03', 'technician', 'كربلاء', true)
on conflict (full_name) do update
set role = excluded.role,
    city = excluded.city,
    is_active = excluded.is_active;

insert into public.installation_vehicles (
  vehicle_number,
  vehicle_type,
  model,
  color,
  year,
  location,
  responsible_staff_id,
  status
)
select
  v.vehicle_number,
  v.vehicle_type,
  v.model,
  v.color,
  v.year,
  v.location,
  s.id,
  v.status
from (
  values
    ('40001 1 أ', 'starex', 'Hyundai Starex', 'أبيض', 2020, 'بغداد', 'فني تركيب 01', 'available'),
    ('50001 1 ب', 'nissan', 'Nissan', 'أبيض', 2021, 'بغداد', 'فني تركيب 02', 'available')
) as v(vehicle_number, vehicle_type, model, color, year, location, staff_name, status)
left join public.installation_staff_members s on s.full_name = v.staff_name
on conflict (vehicle_number) do update
set vehicle_type = excluded.vehicle_type,
    model = excluded.model,
    color = excluded.color,
    year = excluded.year,
    location = excluded.location,
    responsible_staff_id = excluded.responsible_staff_id,
    status = excluded.status,
    updated_at = now();

insert into public.inventory_item_templates (
  department_code,
  category,
  item_name,
  required_quantity,
  sort_order,
  is_active
)
values
  ('installation', 'tools', 'جهاز قياس', 1, 10, true),
  ('installation', 'tools', 'عدة مفكات', 1, 20, true),
  ('installation', 'tools', 'كماشة', 1, 30, true),
  ('installation', 'tools', 'مفتاح ربط', 2, 40, true),
  ('tajhiz', 'tools', 'طفاية', 1, 10, true)
on conflict (department_code, category, item_name) do update
set required_quantity = excluded.required_quantity,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = now();
