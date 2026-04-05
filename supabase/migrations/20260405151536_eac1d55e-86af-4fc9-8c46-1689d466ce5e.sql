
CREATE OR REPLACE FUNCTION public.search_products_paginated(
  p_search text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_date_from text DEFAULT NULL,
  p_date_to text DEFAULT NULL,
  p_printed text DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 50,
  p_user_branch_id uuid DEFAULT NULL,
  p_filter_by_branch boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  name text,
  sku text,
  imei text,
  category_id uuid,
  sale_price numeric,
  import_price numeric,
  import_date timestamptz,
  supplier_id uuid,
  branch_id uuid,
  import_receipt_id uuid,
  status public.product_status,
  note text,
  quantity int,
  unit text,
  is_printed boolean,
  group_id uuid,
  variant_1 text,
  variant_2 text,
  variant_3 text,
  total_rows bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset int := (p_page - 1) * p_page_size;
  v_tenant_id uuid;
BEGIN
  -- Get tenant from current user
  SELECT get_user_tenant_id_secure() INTO v_tenant_id;
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT p.*
    FROM products p
    WHERE p.tenant_id = v_tenant_id
      AND p.status IN ('in_stock', 'sold', 'returned', 'template')
      -- Branch filter
      AND (
        NOT p_filter_by_branch
        OR p_user_branch_id IS NULL
        OR p.branch_id = p_user_branch_id
        OR p.branch_id IS NULL
      )
      -- Category filter
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      -- Supplier filter
      AND (p_supplier_id IS NULL OR p.supplier_id = p_supplier_id)
      -- Status filter
      AND (p_status IS NULL OR p.status = p_status::public.product_status)
      -- Branch specific filter
      AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
      -- Date filters
      AND (p_date_from IS NULL OR p.import_date >= p_date_from::timestamptz)
      AND (p_date_to IS NULL OR p.import_date <= (p_date_to || 'T23:59:59')::timestamptz)
      -- Printed filter
      AND (
        p_printed IS NULL
        OR (p_printed = 'printed' AND p.is_printed = true)
        OR (p_printed = 'not_printed' AND p.is_printed = false)
      )
      -- Search: use separate conditions to leverage GIN indexes
      AND (
        p_search IS NULL
        OR p.name ILIKE '%' || p_search || '%'
        OR p.sku ILIKE '%' || p_search || '%'
        OR p.imei ILIKE '%' || p_search || '%'
      )
  ),
  counted AS (
    SELECT count(*)::bigint AS cnt FROM filtered
  )
  SELECT
    f.id, f.name, f.sku, f.imei, f.category_id, f.sale_price,
    f.import_price, f.import_date, f.supplier_id, f.branch_id,
    f.import_receipt_id, f.status, f.note, f.quantity, f.unit,
    f.is_printed, f.group_id, f.variant_1, f.variant_2, f.variant_3,
    c.cnt
  FROM filtered f, counted c
  ORDER BY f.import_date DESC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;
