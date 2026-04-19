
CREATE OR REPLACE FUNCTION public.find_landing_product_by_short_id(_tenant_id uuid, _short_id text)
RETURNS TABLE(id uuid, name text, description text, image_url text, price numeric, sale_price numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, name, description, image_url, price, sale_price
  FROM public.landing_products
  WHERE tenant_id = _tenant_id AND id::text LIKE _short_id || '%'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.find_landing_article_by_short_id(_tenant_id uuid, _short_id text)
RETURNS TABLE(id uuid, title text, summary text, thumbnail_url text, content text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, title, summary, thumbnail_url, content, created_at
  FROM public.landing_articles
  WHERE tenant_id = _tenant_id AND id::text LIKE _short_id || '%'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_landing_product_by_short_id(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_landing_article_by_short_id(uuid, text) TO anon, authenticated;
