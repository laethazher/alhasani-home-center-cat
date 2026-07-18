-- ============================================================
-- Migration: Add report created vehicle event type
-- يضيف حدث تقرير الفحص إلى سجل المركبة
-- ============================================================

ALTER TABLE public.vehicle_events
  DROP CONSTRAINT IF EXISTS vehicle_events_event_type_check;

ALTER TABLE public.vehicle_events
  ADD CONSTRAINT vehicle_events_event_type_check
  CHECK (event_type IN (
    'driver_assigned', 'driver_removed', 'status_changed',
    'license_renewed', 'insurance_renewed', 'odometer_updated',
    'note_added', 'created', 'vehicle_exit', 'report_created'
  ));

DROP POLICY IF EXISTS "vehicle_events: report insert" ON public.vehicle_events;

CREATE POLICY "vehicle_events: report insert"
  ON public.vehicle_events FOR INSERT
  TO authenticated
  WITH CHECK (event_type = 'report_created');
