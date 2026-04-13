
-- Add date range columns
ALTER TABLE public.leave_requests 
  ADD COLUMN IF NOT EXISTS leave_date_from date,
  ADD COLUMN IF NOT EXISTS leave_date_to date;

-- Migrate existing data
UPDATE public.leave_requests 
SET leave_date_from = leave_date, leave_date_to = leave_date 
WHERE leave_date_from IS NULL;

-- Make columns NOT NULL
ALTER TABLE public.leave_requests 
  ALTER COLUMN leave_date_from SET NOT NULL,
  ALTER COLUMN leave_date_to SET NOT NULL;

-- Drop old unique constraint and column
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_user_id_leave_date_key;
ALTER TABLE public.leave_requests DROP COLUMN IF EXISTS leave_date;

-- Add new unique constraint to prevent overlapping requests
CREATE UNIQUE INDEX IF NOT EXISTS leave_requests_user_overlap_idx 
  ON public.leave_requests (user_id, leave_date_from, leave_date_to);
