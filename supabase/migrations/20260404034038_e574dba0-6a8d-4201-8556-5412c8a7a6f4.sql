
-- Create GIN indexes for fast product search
CREATE INDEX IF NOT EXISTS idx_products_name_gin ON public.products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_sku_gin ON public.products USING gin (sku gin_trgm_ops);

-- Create RPC for fast product search (sale page)
CREATE OR REPLACE FUNCTION public.search_products_for_sale(
  p_search text,
  p_limit int DEFAULT 15
)
RETURNS TABLE(
  id uuid,
  name text,
  sku text,
  imei text,
  import_price numeric,
  sale_price numeric,
  status text,
  category_id uuid,
  branch_id uuid,
  unit text,
  quantity int,
  category_name text,
  branch_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name,
    p.sku,
    p.imei,
    p.import_price,
    p.sale_price,
    p.status::text,
    p.category_id,
    p.branch_id,
    p.unit,
    p.quantity,
    c.name AS category_name,
    b.name AS branch_name
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN branches b ON b.id = p.branch_id
  WHERE p.status = 'in_stock'
    AND p.tenant_id = (SELECT get_user_tenant_id_secure())
    AND (
      p.name ILIKE '%' || p_search || '%'
      OR p.sku ILIKE '%' || p_search || '%'
      OR p.imei ILIKE '%' || p_search || '%'
    )
  ORDER BY
    CASE WHEN p.name ILIKE p_search || '%' THEN 0
         WHEN p.sku ILIKE p_search || '%' THEN 1
         ELSE 2
    END,
    p.name
  LIMIT p_limit;
$$;
