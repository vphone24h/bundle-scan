DROP FUNCTION IF EXISTS public.search_product_suggestions(text, integer);

CREATE OR REPLACE FUNCTION public.search_product_suggestions(p_search text, p_limit integer DEFAULT 20)
RETURNS TABLE(
  product_name text,
  product_sku text,
  category_id uuid,
  latest_import_price numeric,
  latest_sale_price numeric,
  in_stock_qty bigint,
  group_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tenant_filter AS (
    SELECT public.get_user_tenant_id_secure() AS tid
  ),
  grouped_products AS (
    SELECT
      pg.name AS product_name,
      COALESCE(pg.sku_prefix, '') AS product_sku,
      (array_agg(p.category_id ORDER BY p.import_date DESC NULLS LAST))[1] AS category_id,
      NULL::numeric AS latest_import_price,
      NULL::numeric AS latest_sale_price,
      COALESCE(SUM(CASE WHEN p.status = 'in_stock' THEN p.quantity ELSE 0 END), 0)::bigint AS in_stock_qty,
      pg.id AS group_id
    FROM public.products p
    CROSS JOIN tenant_filter tf
    JOIN public.product_groups pg ON p.group_id = pg.id
    WHERE p.tenant_id = tf.tid
      AND p.status IN ('in_stock', 'sold', 'returned', 'template')
      AND (
        pg.name ILIKE '%' || p_search || '%'
        OR COALESCE(pg.sku_prefix, '') ILIKE '%' || p_search || '%'
        OR p.name ILIKE '%' || p_search || '%'
        OR COALESCE(p.sku, '') ILIKE '%' || p_search || '%'
      )
    GROUP BY pg.id, pg.name, pg.sku_prefix
  ),
  standalone_products AS (
    SELECT
      p.name AS product_name,
      p.sku AS product_sku,
      p.category_id,
      (array_agg(p.import_price ORDER BY p.import_date DESC NULLS LAST))[1] AS latest_import_price,
      (array_agg(p.sale_price ORDER BY p.import_date DESC NULLS LAST))[1] AS latest_sale_price,
      COALESCE(SUM(CASE WHEN p.status = 'in_stock' THEN p.quantity ELSE 0 END), 0)::bigint AS in_stock_qty,
      NULL::uuid AS group_id
    FROM public.products p
    CROSS JOIN tenant_filter tf
    WHERE p.tenant_id = tf.tid
      AND p.group_id IS NULL
      AND p.status IN ('in_stock', 'sold', 'returned', 'template')
      AND (
        p.name ILIKE '%' || p_search || '%'
        OR COALESCE(p.sku, '') ILIKE '%' || p_search || '%'
      )
    GROUP BY p.name, p.sku, p.category_id
  ),
  combined AS (
    SELECT * FROM grouped_products
    UNION ALL
    SELECT s.*
    FROM standalone_products s
    WHERE NOT EXISTS (
      SELECT 1 FROM grouped_products gp WHERE gp.product_name = s.product_name
    )
  )
  SELECT *
  FROM combined
  ORDER BY in_stock_qty DESC, product_name ASC
  LIMIT p_limit;
$$;