
-- Landing product categories (reuse existing categories table via a flag or create separate)
CREATE TABLE public.landing_product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INT DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can manage their landing product categories"
  ON public.landing_product_categories FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_id_secure()));

CREATE POLICY "Public can view landing product categories"
  ON public.landing_product_categories FOR SELECT
  USING (true);

-- Landing products
CREATE TABLE public.landing_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.landing_product_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price BIGINT DEFAULT 0,
  sale_price BIGINT,
  image_url TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can manage their landing products"
  ON public.landing_products FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_id_secure()));

CREATE POLICY "Public can view active landing products"
  ON public.landing_products FOR SELECT
  USING (is_active = true);

-- Landing article categories
CREATE TABLE public.landing_article_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_article_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can manage their landing article categories"
  ON public.landing_article_categories FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_id_secure()));

CREATE POLICY "Public can view landing article categories"
  ON public.landing_article_categories FOR SELECT
  USING (true);

-- Landing articles
CREATE TABLE public.landing_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.landing_article_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT,
  summary TEXT,
  content TEXT,
  thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can manage their landing articles"
  ON public.landing_articles FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_id_secure()));

CREATE POLICY "Public can view published landing articles"
  ON public.landing_articles FOR SELECT
  USING (is_published = true);
