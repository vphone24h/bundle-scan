
ALTER TABLE public.tenant_landing_settings
  ADD COLUMN IF NOT EXISTS zalo_oa_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS zalo_access_token text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS zalo_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS zalo_on_export boolean DEFAULT false;
