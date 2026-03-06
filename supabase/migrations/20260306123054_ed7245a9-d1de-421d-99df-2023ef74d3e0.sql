
DROP FUNCTION IF EXISTS public.get_inventory_summary(uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.get_inventory_summary(
  p_tenant_id uuid,
  p_branch_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  sku text,
  branch_id uuid,
  branch_name text,
  category_id uuid,
  category_name text,
  has_imei boolean,
  total_imported bigint,
  total_sold bigint,
  stock bigint,
  avg_import_price numeric,
  total_import_cost numeric,
  oldest_import_date timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH imei_deduped AS (
    SELECT DISTINCT ON (p.imei)
      p.id, p.name, p.sku, p.branch_id, p.category_id, 
      p.import_price, p.status, p.imei, p.import_date
    FROM products p
    WHERE p.imei IS NOT NULL
      AND p.status IN ('in_stock', 'sold', 'returned')
      AND p.tenant_id = p_tenant_id
      AND (p_branch_ids IS NULL OR p.branch_id = ANY(p_branch_ids))
    ORDER BY p.imei, 
      CASE p.status WHEN 'in_stock' THEN 0 WHEN 'returned' THEN 1 ELSE 2 END
  ),
  imei_summary AS (
    SELECT
      (MIN(d.id::text))::uuid as product_id,
      d.name as product_name,
      d.sku,
      d.branch_id,
      b.name as branch_name,
      d.category_id,
      c.name as category_name,
      true as has_imei,
      COUNT(*)::bigint as total_imported,
      COUNT(*) FILTER (WHERE d.status = 'sold')::bigint as total_sold,
      COUNT(*) FILTER (WHERE d.status = 'in_stock')::bigint as stock,
      CASE 
        WHEN COUNT(*) FILTER (WHERE d.status = 'in_stock') > 0 
        THEN ROUND(SUM(d.import_price) FILTER (WHERE d.status = 'in_stock') / COUNT(*) FILTER (WHERE d.status = 'in_stock'), 2)
        ELSE 0
      END as avg_import_price,
      COALESCE(SUM(d.import_price) FILTER (WHERE d.status = 'in_stock'), 0)::numeric as total_import_cost,
      MIN(d.import_date) FILTER (WHERE d.status = 'in_stock') as oldest_import_date
    FROM imei_deduped d
    LEFT JOIN branches b ON b.id = d.branch_id
    LEFT JOIN categories c ON c.id = d.category_id
    GROUP BY d.name, d.sku, d.branch_id, b.name, d.category_id, c.name
  ),
  non_imei_base AS (
    SELECT 
      p.id, p.name, p.sku, p.branch_id, p.category_id,
      p.import_price, p.quantity, p.total_import_cost as p_total_import_cost,
      p.status, p.import_date
    FROM products p
    WHERE p.imei IS NULL
      AND p.status IN ('in_stock', 'sold', 'returned')
      AND p.tenant_id = p_tenant_id
      AND (p_branch_ids IS NULL OR p.branch_id = ANY(p_branch_ids))
  ),
  pi_costs AS (
    SELECT 
      pi.product_id,
      SUM((COALESCE(pi.quantity, 1)) * COALESCE(pi.import_price, 0)) as pi_total_cost,
      SUM(COALESCE(pi.quantity, 1)) as pi_total_qty
    FROM product_imports pi
    INNER JOIN non_imei_base nb ON nb.id = pi.product_id AND nb.status = 'in_stock'
    GROUP BY pi.product_id
  ),
  non_imei_corrected AS (
    SELECT 
      nb.*,
      CASE 
        WHEN nb.status = 'in_stock' AND pic.pi_total_qty > 0 
        THEN nb.quantity * (pic.pi_total_cost / pic.pi_total_qty)
        ELSE nb.p_total_import_cost
      END as corrected_total_cost
    FROM non_imei_base nb
    LEFT JOIN pi_costs pic ON pic.product_id = nb.id
  ),
  non_imei_summary AS (
    SELECT
      (MIN(nc.id::text))::uuid as product_id,
      nc.name as product_name,
      nc.sku,
      nc.branch_id,
      b.name as branch_name,
      nc.category_id,
      c.name as category_name,
      false as has_imei,
      SUM(nc.quantity)::bigint as total_imported,
      COALESCE(SUM(nc.quantity) FILTER (WHERE nc.status = 'sold'), 0)::bigint as total_sold,
      COALESCE(SUM(nc.quantity) FILTER (WHERE nc.status = 'in_stock'), 0)::bigint as stock,
      CASE 
        WHEN COALESCE(SUM(nc.quantity) FILTER (WHERE nc.status = 'in_stock'), 0) > 0
        THEN ROUND(SUM(nc.corrected_total_cost) FILTER (WHERE nc.status = 'in_stock') / SUM(nc.quantity) FILTER (WHERE nc.status = 'in_stock'), 2)
        ELSE 0
      END as avg_import_price,
      COALESCE(SUM(nc.corrected_total_cost) FILTER (WHERE nc.status = 'in_stock'), 0)::numeric as total_import_cost,
      MIN(nc.import_date) FILTER (WHERE nc.status = 'in_stock') as oldest_import_date
    FROM non_imei_corrected nc
    LEFT JOIN branches b ON b.id = nc.branch_id
    LEFT JOIN categories c ON c.id = nc.category_id
    GROUP BY nc.name, nc.sku, nc.branch_id, b.name, nc.category_id, c.name
  )
  SELECT * FROM imei_summary WHERE stock > 0
  UNION ALL
  SELECT * FROM non_imei_summary WHERE stock > 0
  ORDER BY product_name;
$$;
