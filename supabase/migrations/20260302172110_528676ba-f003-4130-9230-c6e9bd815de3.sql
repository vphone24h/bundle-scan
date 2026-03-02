
ALTER TABLE public.tenant_landing_settings
ADD COLUMN IF NOT EXISTS custom_products_page_sections jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS custom_products_page_tabs jsonb DEFAULT '[]'::jsonb;
