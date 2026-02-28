
ALTER TABLE public.tenant_landing_settings
ADD COLUMN IF NOT EXISTS ai_description_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_image_enabled boolean NOT NULL DEFAULT true;
