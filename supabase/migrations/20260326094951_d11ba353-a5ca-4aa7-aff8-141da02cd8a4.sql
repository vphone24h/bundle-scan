
CREATE OR REPLACE FUNCTION public.get_total_warehouse_value(p_tenant_id uuid, p_branch_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only returns inventory value per branch - debt and cash are fetched from existing hooks
  WITH inv AS (
    SELECT
      p.branch_id,
      b.name as branch_name,
      SUM(
        CASE
          WHEN p.imei IS NOT NULL AND p.imei != '' THEN COALESCE(p.import_price, 0)
          ELSE COALESCE(NULLIF(p.total_import_cost, 0), p.import_price * p.quantity, 0)
        END
      ) as value
    FROM products p
    LEFT JOIN branches b ON b.id = p.branch_id
    WHERE p.tenant_id = p_tenant_id
      AND p.status = 'in_stock'
      AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
    GROUP BY p.branch_id, b.name
  )
  SELECT jsonb_build_object(
    'totalInventory', COALESCE((SELECT SUM(value) FROM inv), 0),
    'branches', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'branchId', branch_id,
          'branchName', branch_name,
          'inventoryValue', value
        )
      ) FROM inv),
      '[]'::jsonb
    )
  ) INTO result;

  RETURN result;
END;
$$;
