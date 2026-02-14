
-- Categories for platform articles
CREATE TABLE public.platform_article_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Platform articles (global, no tenant_id)
CREATE TABLE public.platform_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.platform_article_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  summary TEXT,
  banner_url TEXT,
  content TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_platform_articles_category ON public.platform_articles(category_id);
CREATE INDEX idx_platform_articles_published ON public.platform_articles(is_published, display_order);

-- Enable RLS
ALTER TABLE public.platform_article_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_articles ENABLE ROW LEVEL SECURITY;

-- Public read for published articles (all authenticated users can read)
CREATE POLICY "Anyone can read article categories"
ON public.platform_article_categories FOR SELECT
USING (true);

CREATE POLICY "Anyone can read published articles"
ON public.platform_articles FOR SELECT
USING (is_published = true OR public.is_platform_admin(auth.uid()));

-- Only platform admins can manage
CREATE POLICY "Platform admins manage categories"
ON public.platform_article_categories FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins manage articles"
ON public.platform_articles FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- Auto-update timestamps
CREATE TRIGGER update_platform_article_categories_updated_at
BEFORE UPDATE ON public.platform_article_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_platform_articles_updated_at
BEFORE UPDATE ON public.platform_articles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
