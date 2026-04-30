
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'full_day',
  ADD COLUMN IF NOT EXISTS time_minutes integer;

COMMENT ON COLUMN public.leave_requests.request_type IS 'full_day | late_arrival | early_leave';
COMMENT ON COLUMN public.leave_requests.time_minutes IS 'For late_arrival/early_leave: the planned offset in minutes';
