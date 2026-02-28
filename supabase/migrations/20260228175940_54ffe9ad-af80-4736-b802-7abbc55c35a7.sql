
-- Add website_template column to store the selected template type
ALTER TABLE public.tenant_landing_settings 
ADD COLUMN IF NOT EXISTS website_template text DEFAULT 'default';

-- Add comment for documentation
COMMENT ON COLUMN public.tenant_landing_settings.website_template IS 'Selected website template type: phone_store, fashion, spa, restaurant, etc.';
