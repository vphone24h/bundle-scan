
ALTER TABLE public.tenant_landing_settings 
ADD COLUMN IF NOT EXISTS custom_nav_items jsonb DEFAULT NULL;

COMMENT ON COLUMN public.tenant_landing_settings.custom_nav_items IS 'Custom navigation items for the website menu. Array of {id, label, enabled, type, url?, icon?}';
