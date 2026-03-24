ALTER TABLE public.tenant_landing_settings 
ADD COLUMN IF NOT EXISTS footer_why_choose_content text DEFAULT NULL;