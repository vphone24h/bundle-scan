
-- Add failed_emails and is_read columns to email_history
ALTER TABLE public.email_history ADD COLUMN IF NOT EXISTS failed_emails text[] DEFAULT '{}';
ALTER TABLE public.email_history ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE public.email_history ADD COLUMN IF NOT EXISTS read_at timestamptz;
