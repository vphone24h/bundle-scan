
-- Server-side function to get dashboard aggregate stats in a single call
CREATE OR REPLACE FUNCTION public.get_dashboard_aggregates(
  p_tenant_id uuid,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_import_value numeric := 0;
  v_pending_debt numeric := 0;
  v_in_stock integer := 0;
  v_total integer := 0;
  v_sold integer := 0;
BEGIN
  -- Count products by status + calculate import value in one pass
  SELECT 
    COUNT(*) FILTER (WHERE status = 'in_stock'),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'sold'),
    COALESCE(SUM(
      CASE 
        WHEN status = 'in_stock' AND imei IS NOT NULL THEN COALESCE(import_price, 0)
        WHEN status = 'in_stock' AND imei IS NULL THEN COALESCE(total_import_cost, COALESCE(import_price, 0) * COALESCE(quantity, 1))
        ELSE 0
      END
    ), 0)
  INTO v_in_stock, v_total, v_sold, v_total_import_value
  FROM products
  WHERE tenant_id = p_tenant_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);

  -- Sum pending debt from import_receipts
  SELECT COALESCE(SUM(debt_amount), 0)
  INTO v_pending_debt
  FROM import_receipts
  WHERE tenant_id = p_tenant_id
    AND status = 'completed'
    AND debt_amount > 0
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);

  RETURN jsonb_build_object(
    'in_stock', v_in_stock,
    'total', v_total,
    'sold', v_sold,
    'total_import_value', v_total_import_value,
    'pending_debt', v_pending_debt
  );
END;
$$;
