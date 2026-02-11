
ALTER TABLE public.tenant_landing_settings 
ADD COLUMN IF NOT EXISTS custom_domain_article text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS show_custom_domain_cta boolean DEFAULT false;
