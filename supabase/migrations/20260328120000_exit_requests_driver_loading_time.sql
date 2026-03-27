-- Driver loading time tracking (إخراج الكادر — احتساب وقت التحميل)
ALTER TABLE public.exit_requests
  ADD COLUMN IF NOT EXISTS track_driver_loading_time BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loading_minutes_from_shift_start INT,
  ADD COLUMN IF NOT EXISTS loading_delay_minutes INT,
  ADD COLUMN IF NOT EXISTS loading_is_delay BOOLEAN;

COMMENT ON COLUMN public.exit_requests.track_driver_loading_time IS 'When true, loading metrics were recorded for this driver exit request';
COMMENT ON COLUMN public.exit_requests.loading_minutes_from_shift_start IS 'Minutes from 07:00 (Asia/Baghdad) to request creation time';
COMMENT ON COLUMN public.exit_requests.loading_delay_minutes IS 'Minutes after 08:15 grace end; 0 if within grace';
COMMENT ON COLUMN public.exit_requests.loading_is_delay IS 'True if request time is after 08:15 local';
