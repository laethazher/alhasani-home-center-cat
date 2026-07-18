-- Vehicle events table for full history tracking
CREATE TABLE IF NOT EXISTS public.vehicle_events (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id    INTEGER NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN (
    'driver_assigned', 'driver_removed', 'status_changed',
    'license_renewed', 'insurance_renewed', 'odometer_updated',
    'note_added', 'created'
  )),
  description   TEXT NOT NULL DEFAULT '',
  old_value     TEXT,
  new_value     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast per-vehicle lookups
CREATE INDEX idx_vehicle_events_vehicle_id ON public.vehicle_events(vehicle_id);
CREATE INDEX idx_vehicle_events_created_at ON public.vehicle_events(created_at DESC);

-- RLS
ALTER TABLE public.vehicle_events ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "vehicle_events: read"
  ON public.vehicle_events FOR SELECT
  TO authenticated
  USING (true);

-- Only admin can insert/update/delete
CREATE POLICY "vehicle_events: admin insert"
  ON public.vehicle_events FOR INSERT
  TO authenticated
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'user_role') = 'admin'
  );

CREATE POLICY "vehicle_events: admin delete"
  ON public.vehicle_events FOR DELETE
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'user_role') = 'admin'
  );
