
ALTER TABLE public.tenant_landing_settings
ADD COLUMN IF NOT EXISTS custom_product_detail_sections jsonb DEFAULT NULL;
