ALTER TABLE public.landing_products ADD COLUMN IF NOT EXISTS seo_description text;
ALTER TABLE public.landing_articles ADD COLUMN IF NOT EXISTS seo_description text;
COMMENT ON COLUMN public.landing_products.seo_description IS 'Meta description hiển thị trên Google search (~155 ký tự)';
COMMENT ON COLUMN public.landing_articles.seo_description IS 'Meta description hiển thị trên Google search (~155 ký tự)';