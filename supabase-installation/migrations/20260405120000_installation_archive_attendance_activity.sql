-- مواءمة سلوك أرشفة حضور التركيب مع التجهيز: تسجيل حدث في سجل النشاط بعد النقل
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

  if p_day is null then
    return jsonb_build_object('success', false, 'error', 'no_date');
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

  insert into public.installation_attendance_activity_log (action_type, entity_type, metadata, user_id)
  values (
    'archive',
    'attendance',
    jsonb_build_object('date', p_day, 'count', moved_count),
    auth.uid()
  );

  return jsonb_build_object('success', true, 'archived_count', moved_count, 'day', p_day);
exception
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;
