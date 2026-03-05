
-- Add source column to email_automation_logs
ALTER TABLE public.email_automation_logs 
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'automation';

-- Make automation_id nullable to support care emails without automation
ALTER TABLE public.email_automation_logs 
  ALTER COLUMN automation_id DROP NOT NULL;

-- Drop the existing FK constraint so automation_id can be null
ALTER TABLE public.email_automation_logs 
  DROP CONSTRAINT IF EXISTS email_automation_logs_automation_id_fkey;

-- Re-add FK as optional
ALTER TABLE public.email_automation_logs
  ADD CONSTRAINT email_automation_logs_automation_id_fkey 
  FOREIGN KEY (automation_id) REFERENCES public.email_automations(id) ON DELETE SET NULL;
