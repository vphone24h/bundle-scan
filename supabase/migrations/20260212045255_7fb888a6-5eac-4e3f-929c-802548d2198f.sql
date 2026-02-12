
-- Table to track individual email opens via tracking pixel
CREATE TABLE public.email_opens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_history_id UUID NOT NULL REFERENCES public.email_history(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Index for fast lookups
CREATE INDEX idx_email_opens_history_id ON public.email_opens(email_history_id);
CREATE UNIQUE INDEX idx_email_opens_unique ON public.email_opens(email_history_id, recipient_email);

-- RLS
ALTER TABLE public.email_opens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view email opens"
ON public.email_opens FOR SELECT
USING (public.is_platform_admin(auth.uid()));
