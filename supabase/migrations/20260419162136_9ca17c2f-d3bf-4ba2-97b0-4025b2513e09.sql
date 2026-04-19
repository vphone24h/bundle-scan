ALTER TABLE public.platform_email_automations
ADD COLUMN max_sends_per_recipient INTEGER NOT NULL DEFAULT 1
CHECK (max_sends_per_recipient >= 1 AND max_sends_per_recipient <= 10);

ALTER TABLE public.email_automations
ADD COLUMN max_sends_per_recipient INTEGER NOT NULL DEFAULT 1
CHECK (max_sends_per_recipient >= 1 AND max_sends_per_recipient <= 10);