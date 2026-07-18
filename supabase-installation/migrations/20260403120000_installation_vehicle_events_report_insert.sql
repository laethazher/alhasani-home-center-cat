-- ============================================================
-- السماح بتسجيل حدث تقرير الفحص في سجل مركبات التركيب
-- (مطابقة لسياسة vehicle_events في التجهيز: أي مستخدم مصادق يمكنه
--  إدراج صف واحد من نوع report_created فقط)
-- ============================================================

drop policy if exists "installation_vehicle_events: report insert" on public.installation_vehicle_events;

create policy "installation_vehicle_events: report insert"
  on public.installation_vehicle_events for insert
  to authenticated
  with check (event_type = 'report_created');
