-- Add news page layout sections to tenant_landing_settings
ALTER TABLE public.tenant_landing_settings
ADD COLUMN IF NOT EXISTS custom_news_page_sections jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS custom_news_page_tabs jsonb DEFAULT NULL;