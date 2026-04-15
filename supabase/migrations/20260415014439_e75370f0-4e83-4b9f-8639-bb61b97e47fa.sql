
ALTER TABLE public.tenant_landing_settings 
ADD COLUMN IF NOT EXISTS zalo_oa_name TEXT,
ADD COLUMN IF NOT EXISTS zalo_oa_avatar TEXT;
