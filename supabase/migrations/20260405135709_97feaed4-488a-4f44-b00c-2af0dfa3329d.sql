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
  scoped_products AS (
    SELECT
      p.*,
      pg.name AS group_name,
      pg.sku_prefix,
      COALESCE(
        NULLIF(BTRIM(pg.name), ''),
        NULLIF(BTRIM(regexp_replace(
          p.name,
          CONCAT(
            '(\\s+',
            COALESCE(NULLIF(regexp_replace(p.variant_1, '([\\^$.|?*+(){}\\[\\]\\\\])', '\\\\\1', 'g'), ''), '(?!)'),
            ')?',
            '(\\s+',
            COALESCE(NULLIF(regexp_replace(p.variant_2, '([\\^$.|?*+(){}\\[\\]\\\\])', '\\\\\1', 'g'), ''), '(?!)'),
            ')?',
            '(\\s+',
            COALESCE(NULLIF(regexp_replace(p.variant_3, '([\\^$.|?*+(){}\\[\\]\\\\])', '\\\\\1', 'g'), ''), '(?!)'),
            ')?$'
          ),
          '',
          'i'
        )), ''),
        p.name
      ) AS suggestion_name,
      CASE
        WHEN p.group_id IS NOT NULL OR p.variant_1 IS NOT NULL OR p.variant_2 IS NOT NULL OR p.variant_3 IS NOT NULL THEN true
        ELSE false
      END AS is_variant_like
    FROM public.products p
    CROSS JOIN tenant_filter tf
    LEFT JOIN public.product_groups pg ON p.group_id = pg.id
    WHERE p.tenant_id = tf.tid
      AND p.status IN ('in_stock', 'sold', 'returned', 'template')
  ),
  variant_groups AS (
    SELECT
      sp.suggestion_name AS product_name,
      COALESCE(MAX(NULLIF(sp.sku_prefix, '')), '') AS product_sku,
      (array_agg(sp.category_id ORDER BY sp.import_date DESC NULLS LAST))[1] AS category_id,
      NULL::numeric AS latest_import_price,
      NULL::numeric AS latest_sale_price,
      COALESCE(SUM(CASE WHEN sp.status = 'in_stock' THEN sp.quantity ELSE 0 END), 0)::bigint AS in_stock_qty
    FROM scoped_products sp
    WHERE sp.is_variant_like = true
      AND (
        sp.suggestion_name ILIKE '%' || p_search || '%'
        OR COALESCE(sp.sku_prefix, '') ILIKE '%' || p_search || '%'
        OR sp.name ILIKE '%' || p_search || '%'
        OR COALESCE(sp.sku, '') ILIKE '%' || p_search || '%'
      )
    GROUP BY sp.suggestion_name
  ),
  standalone AS (
    SELECT
      sp.name AS product_name,
      sp.sku AS product_sku,
      (array_agg(sp.category_id ORDER BY sp.import_date DESC NULLS LAST))[1] AS category_id,
      (array_agg(sp.import_price ORDER BY sp.import_date DESC NULLS LAST))[1] AS latest_import_price,
      (array_agg(sp.sale_price ORDER BY sp.import_date DESC NULLS LAST))[1] AS latest_sale_price,
      COALESCE(SUM(CASE WHEN sp.status = 'in_stock' THEN sp.quantity ELSE 0 END), 0)::bigint AS in_stock_qty
    FROM scoped_products sp
    WHERE sp.is_variant_like = false
      AND (
        sp.name ILIKE '%' || p_search || '%'
        OR COALESCE(sp.sku, '') ILIKE '%' || p_search || '%'
      )
    GROUP BY sp.name, sp.sku
  ),
  combined AS (
    SELECT * FROM variant_groups
    UNION ALL
    SELECT s.*
    FROM standalone s
    WHERE NOT EXISTS (
      SELECT 1 FROM variant_groups vg WHERE vg.product_name = s.product_name
    )
  )
  SELECT *
  FROM combined
  ORDER BY in_stock_qty DESC, product_name ASC
  LIMIT p_limit;
$$;