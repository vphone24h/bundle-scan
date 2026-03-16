
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
  -- Get base names from product_groups
  group_names AS (
    SELECT DISTINCT pg.name AS base_name
    FROM product_groups pg
    CROSS JOIN tenant_filter tf
    WHERE pg.tenant_id = tf.tid
      AND pg.name ILIKE '%' || p_search || '%'
  ),
  -- Get products that belong to a group (variant products)
  variant_products AS (
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
      AND p.status IN ('in_stock', 'sold', 'returned')
      AND pg.name ILIKE '%' || p_search || '%'
    GROUP BY pg.name, pg.sku_prefix
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
      AND p.status IN ('in_stock', 'sold', 'returned')
      AND (p.name ILIKE '%' || p_search || '%' OR p.sku ILIKE '%' || p_search || '%')
    GROUP BY p.name, p.sku
  ),
  -- Also include group names that have no products yet
  empty_groups AS (
    SELECT
      gn.base_name AS name,
      '' AS sku,
      NULL::uuid AS cat_id,
      NULL::numeric AS imp_price,
      NULL::numeric AS sal_price,
      0::bigint AS stock_qty
    FROM group_names gn
    WHERE NOT EXISTS (
      SELECT 1 FROM variant_products vp WHERE vp.base_name = gn.base_name
    )
  ),
  combined AS (
    -- Variant products: show base name only
    SELECT
      vp.base_name AS product_name,
      COALESCE(vp.sku_prefix, '') AS product_sku,
      vp.cat_id AS category_id,
      vp.imp_price AS latest_import_price,
      vp.sal_price AS latest_sale_price,
      vp.stock_qty AS in_stock_qty
    FROM variant_products vp
    
    UNION ALL
    
    -- Standalone products: show as-is
    SELECT
      s.name AS product_name,
      s.sku AS product_sku,
      s.cat_id AS category_id,
      s.imp_price AS latest_import_price,
      s.sal_price AS latest_sale_price,
      s.stock_qty AS in_stock_qty
    FROM standalone s
    -- Exclude standalone products whose name matches a group base name
    WHERE NOT EXISTS (
      SELECT 1 FROM variant_products vp WHERE s.name = vp.base_name
    )
    
    UNION ALL
    
    -- Empty groups
    SELECT * FROM empty_groups
  )
  SELECT * FROM combined
  ORDER BY in_stock_qty DESC, product_name ASC
  LIMIT p_limit;
$$;
