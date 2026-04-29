
-- Helpful composite index for group-based pagination
CREATE INDEX IF NOT EXISTS idx_products_tenant_group_date
  ON public.products (tenant_id, group_id, import_date DESC)
  WHERE status IN ('in_stock','sold','returned','template');

-- =====================================================================
-- list_product_groups: server-side grouped pagination
-- =====================================================================
CREATE OR REPLACE FUNCTION public.list_product_groups(
  p_search text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_printed_filter text DEFAULT NULL,  -- 'printed' | 'not_printed' | NULL
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_branch_id uuid;
  v_can_view_all boolean;
  v_offset int;
  v_total bigint;
  v_items jsonb;
  v_search_pattern text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('items', '[]'::jsonb, 'total_groups', 0);
  END IF;

  -- Resolve tenant + branch scope from platform_users
  SELECT pu.tenant_id, pu.branch_id, COALESCE(pu.can_view_all_branches, true)
  INTO v_tenant_id, v_branch_id, v_can_view_all
  FROM public.platform_users pu
  WHERE pu.user_id = v_user_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('items', '[]'::jsonb, 'total_groups', 0);
  END IF;

  v_offset := GREATEST(0, (COALESCE(p_page,1) - 1) * COALESCE(p_page_size, 25));
  v_search_pattern := CASE WHEN p_search IS NOT NULL AND length(trim(p_search)) > 0
    THEN '%' || trim(p_search) || '%' ELSE NULL END;

  -- Step 1: filtered products → assign group_key (group_id OR solo:id)
  -- Step 2: pick representative variant per group_key (latest import_date)
  -- Step 3: paginate groups
  WITH filtered AS (
    SELECT
      p.*,
      COALESCE(p.group_id::text, 'solo:' || p.id::text) AS group_key
    FROM public.products p
    WHERE p.tenant_id = v_tenant_id
      AND p.status IN ('in_stock','sold','returned','template')
      AND (v_can_view_all OR v_branch_id IS NULL OR p.branch_id = v_branch_id OR p.branch_id IS NULL)
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_supplier_id IS NULL OR p.supplier_id = p_supplier_id)
      AND (p_status IS NULL OR p.status::text = p_status)
      AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
      AND (p_date_from IS NULL OR p.import_date >= p_date_from)
      AND (p_date_to IS NULL OR p.import_date <= p_date_to)
      AND (p_printed_filter IS NULL
           OR (p_printed_filter = 'printed' AND p.is_printed = true)
           OR (p_printed_filter = 'not_printed' AND p.is_printed = false))
      AND (v_search_pattern IS NULL
           OR p.name ILIKE v_search_pattern
           OR p.sku ILIKE v_search_pattern
           OR (p_search ~ '^\d+$' AND p.imei ILIKE v_search_pattern))
  ),
  groups AS (
    SELECT
      group_key,
      COUNT(*) AS variant_count,
      MAX(import_date) AS latest_import,
      -- Pick representative: latest import within the group
      (ARRAY_AGG(id ORDER BY import_date DESC, id DESC))[1] AS rep_id
    FROM filtered
    GROUP BY group_key
  ),
  total AS (SELECT COUNT(*) AS c FROM groups),
  page AS (
    SELECT g.*
    FROM groups g
    ORDER BY g.latest_import DESC, g.group_key
    LIMIT COALESCE(p_page_size, 25)
    OFFSET v_offset
  )
  SELECT
    (SELECT c FROM total),
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'group_key', pg.group_key,
        'group_id', CASE WHEN pg.group_key LIKE 'solo:%' THEN NULL ELSE pg.group_key END,
        'variant_count', pg.variant_count,
        'rep', jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'sku', p.sku,
          'imei', p.imei,
          'category_id', p.category_id,
          'sale_price', p.sale_price,
          'import_price', p.import_price,
          'import_date', p.import_date,
          'supplier_id', p.supplier_id,
          'branch_id', p.branch_id,
          'import_receipt_id', p.import_receipt_id,
          'status', p.status,
          'note', p.note,
          'quantity', p.quantity,
          'unit', p.unit,
          'is_printed', p.is_printed,
          'group_id', p.group_id,
          'variant_1', p.variant_1,
          'variant_2', p.variant_2,
          'variant_3', p.variant_3
        )
      )
      ORDER BY pg.latest_import DESC, pg.group_key
    ), '[]'::jsonb)
  INTO v_total, v_items
  FROM page pg
  JOIN public.products p ON p.id = pg.rep_id;

  RETURN jsonb_build_object('items', v_items, 'total_groups', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_product_groups(text, uuid, uuid, text, uuid, timestamptz, timestamptz, text, int, int) TO authenticated;

-- =====================================================================
-- get_group_variants: lazy-load all variants of a single group
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_group_variants(
  p_group_key text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_branch_id uuid;
  v_can_view_all boolean;
  v_items jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT pu.tenant_id, pu.branch_id, COALESCE(pu.can_view_all_branches, true)
  INTO v_tenant_id, v_branch_id, v_can_view_all
  FROM public.platform_users pu
  WHERE pu.user_id = v_user_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF p_group_key LIKE 'solo:%' THEN
    -- Solo product → return single row
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', p.id, 'name', p.name, 'sku', p.sku, 'imei', p.imei,
        'category_id', p.category_id, 'sale_price', p.sale_price,
        'import_price', p.import_price, 'import_date', p.import_date,
        'supplier_id', p.supplier_id, 'branch_id', p.branch_id,
        'import_receipt_id', p.import_receipt_id, 'status', p.status,
        'note', p.note, 'quantity', p.quantity, 'unit', p.unit,
        'is_printed', p.is_printed, 'group_id', p.group_id,
        'variant_1', p.variant_1, 'variant_2', p.variant_2, 'variant_3', p.variant_3
      )
    ), '[]'::jsonb)
    INTO v_items
    FROM public.products p
    WHERE p.id = (substring(p_group_key from 6))::uuid
      AND p.tenant_id = v_tenant_id
      AND (v_can_view_all OR v_branch_id IS NULL OR p.branch_id = v_branch_id OR p.branch_id IS NULL);
  ELSE
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', p.id, 'name', p.name, 'sku', p.sku, 'imei', p.imei,
        'category_id', p.category_id, 'sale_price', p.sale_price,
        'import_price', p.import_price, 'import_date', p.import_date,
        'supplier_id', p.supplier_id, 'branch_id', p.branch_id,
        'import_receipt_id', p.import_receipt_id, 'status', p.status,
        'note', p.note, 'quantity', p.quantity, 'unit', p.unit,
        'is_printed', p.is_printed, 'group_id', p.group_id,
        'variant_1', p.variant_1, 'variant_2', p.variant_2, 'variant_3', p.variant_3
      )
      ORDER BY p.import_date DESC, p.id DESC
    ), '[]'::jsonb)
    INTO v_items
    FROM public.products p
    WHERE p.group_id = p_group_key::uuid
      AND p.tenant_id = v_tenant_id
      AND p.status IN ('in_stock','sold','returned','template')
      AND (v_can_view_all OR v_branch_id IS NULL OR p.branch_id = v_branch_id OR p.branch_id IS NULL);
  END IF;

  RETURN v_items;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_variants(text) TO authenticated;
