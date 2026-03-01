
-- Add custom_product_tabs to tenant_landing_settings (stores tab definitions)
-- Format: [{id: "tab_xxx", name: "iPhone giá tốt", displayStyle: "grid"}]
ALTER TABLE public.tenant_landing_settings
ADD COLUMN IF NOT EXISTS custom_product_tabs jsonb DEFAULT '[]'::jsonb;

-- Add home_tab_ids to products (which custom tabs this product belongs to)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS home_tab_ids text[] DEFAULT '{}';

-- Comment for clarity
COMMENT ON COLUMN public.tenant_landing_settings.custom_product_tabs IS 'Custom product tab definitions for homepage layout: [{id, name, displayStyle, enabled}]';
COMMENT ON COLUMN public.products.home_tab_ids IS 'Array of custom product tab IDs this product belongs to on the homepage';
