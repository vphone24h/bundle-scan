
-- Change default to false for AI features (per-tenant, default OFF)
ALTER TABLE public.tenant_landing_settings 
  ALTER COLUMN ai_description_enabled SET DEFAULT false,
  ALTER COLUMN auto_image_enabled SET DEFAULT false;

-- Set all existing tenants to false (reset to off)
UPDATE public.tenant_landing_settings 
SET ai_description_enabled = false, auto_image_enabled = false;
