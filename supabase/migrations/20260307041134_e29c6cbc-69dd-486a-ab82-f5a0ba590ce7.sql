
CREATE OR REPLACE FUNCTION public.search_product_suggestions(p_search text, p_limit integer DEFAULT 20)
RETURNS TABLE(
  product_name text,
  product_sku text,
  category_id uuid,
  latest_import_price numeric,
  latest_sale_price numeric,
  in_stock_qty bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH tenant_filter AS (
    SELECT public.get_user_tenant_id_secure() AS tid
  ),
  grouped AS (
    SELECT
      p.name,
      p.sku,
      (array_agg(p.category_id ORDER BY p.import_date DESC NULLS LAST))[1] AS cat_id,
      (array_agg(p.import_price ORDER BY p.import_date DESC NULLS LAST))[1] AS imp_price,
      (array_agg(p.sale_price ORDER BY p.import_date DESC NULLS LAST))[1] AS sal_price,
      COALESCE(SUM(CASE WHEN p.status = 'in_stock' THEN p.quantity ELSE 0 END), 0) AS stock_qty
    FROM products p
    CROSS JOIN tenant_filter tf
    WHERE p.tenant_id = tf.tid
      AND p.status IN ('in_stock', 'sold', 'returned')
      AND (p.name ILIKE '%' || p_search || '%' OR p.sku ILIKE '%' || p_search || '%')
    GROUP BY p.name, p.sku
  )
  SELECT
    g.name AS product_name,
    g.sku AS product_sku,
    g.cat_id AS category_id,
    g.imp_price AS latest_import_price,
    g.sal_price AS latest_sale_price,
    g.stock_qty AS in_stock_qty
  FROM grouped g
  ORDER BY g.stock_qty DESC, g.name ASC
  LIMIT p_limit;
$$;
