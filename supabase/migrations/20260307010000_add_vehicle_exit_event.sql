-- ============================================================
-- Migration: Add vehicle exit event type
-- إضافة نوع event جديد لإخراج المركبة
-- ============================================================

-- إضافة نوع event جديد 'vehicle_exit' إلى vehicle_events
ALTER TABLE public.vehicle_events
  DROP CONSTRAINT IF EXISTS vehicle_events_event_type_check;

ALTER TABLE public.vehicle_events
  ADD CONSTRAINT vehicle_events_event_type_check
  CHECK (event_type IN (
    'driver_assigned', 'driver_removed', 'status_changed',
    'license_renewed', 'insurance_renewed', 'odometer_updated',
    'note_added', 'created', 'vehicle_exit'
  ));
