ALTER TABLE public.tenant_landing_settings 
ADD COLUMN IF NOT EXISTS zalo_zns_template_id text DEFAULT null;