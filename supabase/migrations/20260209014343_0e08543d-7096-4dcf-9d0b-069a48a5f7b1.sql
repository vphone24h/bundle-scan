
-- Create email history table
CREATE TABLE public.email_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  html_content TEXT,
  recipients JSONB NOT NULL DEFAULT '[]',
  total_recipients INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  sent_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_history ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view
CREATE POLICY "Platform admins can view email history"
ON public.email_history
FOR SELECT
USING (public.is_platform_admin(auth.uid()));

-- Only service role inserts (from edge function)
CREATE POLICY "Service role can insert email history"
ON public.email_history
FOR INSERT
WITH CHECK (public.is_platform_admin(auth.uid()));
