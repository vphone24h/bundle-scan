ALTER TABLE public.tenant_landing_settings 
ADD COLUMN IF NOT EXISTS gov_registration_url text,
ADD COLUMN IF NOT EXISTS gov_registration_image_url text;