
-- Add new columns to landing_article_categories
ALTER TABLE public.landing_article_categories 
  ADD COLUMN image_url text,
  ADD COLUMN parent_id uuid REFERENCES public.landing_article_categories(id) ON DELETE SET NULL,
  ADD COLUMN is_visible boolean NOT NULL DEFAULT true;

-- Add is_featured_home to landing_articles for homepage display
ALTER TABLE public.landing_articles 
  ADD COLUMN is_featured_home boolean NOT NULL DEFAULT false;

-- Index for parent_id lookups
CREATE INDEX idx_landing_article_categories_parent_id ON public.landing_article_categories(parent_id);

-- Index for featured home articles
CREATE INDEX idx_landing_articles_featured_home ON public.landing_articles(tenant_id, is_featured_home) WHERE is_featured_home = true;
