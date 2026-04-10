ALTER TABLE public.payroll_records 
  ADD COLUMN IF NOT EXISTS late_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absent_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_leave_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_hours numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_work_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attendance_details jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS late_minutes_total integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_leave_minutes_total integer DEFAULT 0;