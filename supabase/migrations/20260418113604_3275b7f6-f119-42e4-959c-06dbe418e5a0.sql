-- Sửa RPC search_product_suggestions: chỉ trả về group có sản phẩm, ưu tiên group đầy đủ
CREATE OR REPLACE FUNCTION public.search_product_suggestions(p_search text, p_limit integer DEFAULT 50)
 RETURNS TABLE(product_name text, product_sku text, category_id uuid, latest_import_price numeric, latest_sale_price numeric, in_stock_qty bigint, group_id uuid, unit text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH tenant_filter AS (
    SELECT public.get_user_tenant_id_secure() AS tid
  ),
  -- Lấy tất cả group khớp tên search, kèm số lượng product hợp lệ
  group_candidates AS (
    SELECT
      pg.id AS group_id,
      pg.name AS product_name,
      COALESCE(pg.sku_prefix, '') AS product_sku,
      COUNT(p.id) FILTER (WHERE p.status IN ('in_stock','template','sold')) AS product_count,
      (array_agg(p.category_id ORDER BY p.import_date DESC NULLS LAST) FILTER (WHERE p.category_id IS NOT NULL))[1] AS category_id,
      COALESCE(SUM(CASE WHEN p.status = 'in_stock' THEN p.quantity ELSE 0 END), 0)::bigint AS in_stock_qty,
      COALESCE((array_agg(p.unit ORDER BY p.import_date DESC NULLS LAST) FILTER (WHERE p.unit IS NOT NULL))[1], 'cái') AS unit,
      pg.created_at AS group_created_at
    FROM public.product_groups pg
    CROSS JOIN tenant_filter tf
    LEFT JOIN public.products p ON p.group_id = pg.id AND p.tenant_id = tf.tid AND p.status IN ('in_stock','template','sold')
    WHERE pg.tenant_id = tf.tid
      AND (
        pg.name ILIKE '%' || p_search || '%'
        OR COALESCE(pg.sku_prefix, '') ILIKE '%' || p_search || '%'
      )
    GROUP BY pg.id, pg.name, pg.sku_prefix, pg.created_at
  ),
  -- Với các group cùng tên, chọn group có nhiều product nhất (mới nhất khi hoà)
  grouped_products AS (
    SELECT DISTINCT ON (LOWER(TRIM(product_name)))
      product_name,
      product_sku,
      category_id,
      NULL::numeric AS latest_import_price,
      NULL::numeric AS latest_sale_price,
      in_stock_qty,
      group_id,
      unit
    FROM group_candidates
    WHERE product_count > 0
    ORDER BY LOWER(TRIM(product_name)), product_count DESC, group_created_at DESC
  ),
  variant_no_group AS (
    SELECT
      TRIM(
        REPLACE(
          REPLACE(
            REPLACE(p.name, COALESCE(p.variant_1, ''), ''),
            COALESCE(p.variant_2, ''), ''),
          COALESCE(p.variant_3, ''), '')
      ) AS product_name,
      '' AS product_sku,
      (array_agg(p.category_id ORDER BY p.import_date DESC NULLS LAST))[1] AS category_id,
      NULL::numeric AS latest_import_price,
      NULL::numeric AS latest_sale_price,
      COALESCE(SUM(CASE WHEN p.status = 'in_stock' THEN p.quantity ELSE 0 END), 0)::bigint AS in_stock_qty,
      NULL::uuid AS group_id,
      COALESCE((array_agg(p.unit ORDER BY p.import_date DESC NULLS LAST) FILTER (WHERE p.unit IS NOT NULL))[1], 'cái') AS unit
    FROM public.products p
    CROSS JOIN tenant_filter tf
    WHERE p.tenant_id = tf.tid
      AND p.group_id IS NULL
      AND p.status IN ('in_stock', 'template', 'sold')
      AND (p.variant_1 IS NOT NULL OR p.variant_2 IS NOT NULL OR p.variant_3 IS NOT NULL)
      AND (
        p.name ILIKE '%' || p_search || '%'
        OR COALESCE(p.sku, '') ILIKE '%' || p_search || '%'
      )
    GROUP BY TRIM(
        REPLACE(
          REPLACE(
            REPLACE(p.name, COALESCE(p.variant_1, ''), ''),
            COALESCE(p.variant_2, ''), ''),
          COALESCE(p.variant_3, ''), '')
      )
  ),
  standalone_products AS (
    SELECT
      p.name AS product_name,
      p.sku AS product_sku,
      p.category_id,
      (array_agg(p.import_price ORDER BY p.import_date DESC NULLS LAST))[1] AS latest_import_price,
      (array_agg(p.sale_price ORDER BY p.import_date DESC NULLS LAST))[1] AS latest_sale_price,
      COALESCE(SUM(CASE WHEN p.status = 'in_stock' THEN p.quantity ELSE 0 END), 0)::bigint AS in_stock_qty,
      NULL::uuid AS group_id,
      COALESCE((array_agg(p.unit ORDER BY p.import_date DESC NULLS LAST) FILTER (WHERE p.unit IS NOT NULL))[1], 'cái') AS unit
    FROM public.products p
    CROSS JOIN tenant_filter tf
    WHERE p.tenant_id = tf.tid
      AND p.group_id IS NULL
      AND p.status IN ('in_stock', 'template', 'sold')
      AND p.variant_1 IS NULL
      AND p.variant_2 IS NULL
      AND p.variant_3 IS NULL
      AND (
        p.name ILIKE '%' || p_search || '%'
        OR COALESCE(p.sku, '') ILIKE '%' || p_search || '%'
      )
    GROUP BY p.name, p.sku, p.category_id
  ),
  combined AS (
    SELECT * FROM grouped_products
    UNION ALL
    SELECT vng.*
    FROM variant_no_group vng
    WHERE NOT EXISTS (
      SELECT 1 FROM grouped_products gp WHERE LOWER(TRIM(gp.product_name)) = LOWER(TRIM(vng.product_name))
    )
    UNION ALL
    SELECT s.*
    FROM standalone_products s
    WHERE NOT EXISTS (
      SELECT 1 FROM grouped_products gp WHERE LOWER(TRIM(gp.product_name)) = LOWER(TRIM(s.product_name))
    )
    AND NOT EXISTS (
      SELECT 1 FROM variant_no_group vng WHERE LOWER(TRIM(vng.product_name)) = LOWER(TRIM(s.product_name))
    )
  )
  SELECT *
  FROM combined
  ORDER BY in_stock_qty DESC, product_name ASC
  LIMIT p_limit;
$function$;