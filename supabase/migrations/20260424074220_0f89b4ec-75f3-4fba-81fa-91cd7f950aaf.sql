DROP FUNCTION IF EXISTS public.find_landing_product_by_short_id(uuid, text);
DROP FUNCTION IF EXISTS public.find_landing_article_by_short_id(uuid, text);

CREATE FUNCTION public.find_landing_product_by_short_id(_tenant_id uuid, _short_id text)
RETURNS TABLE(id uuid, name text, description text, seo_description text, image_url text, price numeric, sale_price numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id, name, description, seo_description, image_url, price, sale_price
  FROM public.landing_products
  WHERE tenant_id = _tenant_id AND id::text LIKE _short_id || '%'
  LIMIT 1;
$function$;

CREATE FUNCTION public.find_landing_article_by_short_id(_tenant_id uuid, _short_id text)
RETURNS TABLE(id uuid, title text, summary text, seo_description text, thumbnail_url text, content text, created_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id, title, summary, seo_description, thumbnail_url, content, created_at
  FROM public.landing_articles
  WHERE tenant_id = _tenant_id AND id::text LIKE _short_id || '%'
  LIMIT 1;
$function$;