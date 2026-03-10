CREATE OR REPLACE FUNCTION get_dashboard_aggregates(p_tenant_id uuid, p_branch_id uuid DEFAULT NULL)
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
  v_total_stock_qty bigint := 0;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE status = 'in_stock'),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'sold')
  INTO v_in_stock, v_total, v_sold
  FROM products
  WHERE tenant_id = p_tenant_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);

  SELECT COALESCE(SUM(total_import_cost), 0), COALESCE(SUM(stock), 0)
  INTO v_total_import_value, v_total_stock_qty
  FROM get_inventory_summary(
    p_tenant_id,
    CASE WHEN p_branch_id IS NOT NULL THEN ARRAY[p_branch_id] ELSE NULL END
  );

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
    'pending_debt', v_pending_debt,
    'total_stock_qty', v_total_stock_qty
  );
END;
$$;