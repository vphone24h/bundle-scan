
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS early_arrival_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_overtime_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS overtime_approved_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS overtime_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS overtime_review_note text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema='public' AND table_name='attendance_records' AND constraint_name='attendance_records_overtime_status_check'
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_overtime_status_check
      CHECK (overtime_status IN ('none','pending','approved','rejected'));
  END IF;
END $$;

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS deduct_salary boolean NOT NULL DEFAULT false;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS compensation_threshold_minutes integer NOT NULL DEFAULT 60;
