
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS attendance_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.companies.attendance_enabled IS 'Platform admin toggle to enable/disable attendance system for entire company';
