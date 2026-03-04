
ALTER TABLE public.tenant_landing_settings 
  ADD COLUMN IF NOT EXISTS zalo_app_id text,
  ADD COLUMN IF NOT EXISTS zalo_app_secret text,
  ADD COLUMN IF NOT EXISTS zalo_refresh_token text;
