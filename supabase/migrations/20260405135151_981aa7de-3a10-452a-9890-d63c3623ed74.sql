
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
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tenant_filter AS (
    SELECT public.get_user_tenant_id_secure() AS tid
  ),
  -- Get variant groups: show only base group name (not individual variants)
  variant_groups AS (
    SELECT
      pg.name AS base_name,
      pg.sku_prefix,
      (array_agg(p.category_id ORDER BY p.import_date DESC NULLS LAST))[1] AS cat_id,
      NULL::numeric AS imp_price,
      NULL::numeric AS sal_price,
      COALESCE(SUM(CASE WHEN p.status = 'in_stock' THEN p.quantity ELSE 0 END), 0) AS stock_qty
    FROM products p
    CROSS JOIN tenant_filter tf
    JOIN product_groups pg ON p.group_id = pg.id
    WHERE p.tenant_id = tf.tid
      AND p.status IN ('in_stock', 'sold', 'returned', 'template')
      AND (pg.name ILIKE '%' || p_search || '%' OR pg.sku_prefix ILIKE '%' || p_search || '%')
    GROUP BY pg.id, pg.name, pg.sku_prefix
  ),
  -- Get standalone products (no group_id)
  standalone AS (
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
      AND p.group_id IS NULL
      AND p.status IN ('in_stock', 'sold', 'returned', 'template')
      AND (p.name ILIKE '%' || p_search || '%' OR p.sku ILIKE '%' || p_search || '%')
    GROUP BY p.name, p.sku
  ),
  combined AS (
    SELECT
      vg.base_name AS product_name,
      COALESCE(vg.sku_prefix, '') AS product_sku,
      vg.cat_id AS category_id,
      vg.imp_price AS latest_import_price,
      vg.sal_price AS latest_sale_price,
      vg.stock_qty AS in_stock_qty
    FROM variant_groups vg

    UNION ALL

    SELECT
      s.name AS product_name,
      s.sku AS product_sku,
      s.cat_id AS category_id,
      s.imp_price AS latest_import_price,
      s.sal_price AS latest_sale_price,
      s.stock_qty AS in_stock_qty
    FROM standalone s
    WHERE NOT EXISTS (
      SELECT 1 FROM variant_groups vg WHERE s.name = vg.base_name
    )
  )
  SELECT * FROM combined
  ORDER BY in_stock_qty DESC, product_name ASC
  LIMIT p_limit;
$$;
