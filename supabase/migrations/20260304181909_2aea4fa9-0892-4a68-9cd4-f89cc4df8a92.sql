
CREATE OR REPLACE FUNCTION public.get_import_summary_stats(_tenant_id uuid, _branch_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'totalImportValue', COALESCE(SUM(CASE WHEN true THEN COALESCE(p.total_import_cost, p.import_price * COALESCE(p.quantity, 1)) ELSE 0 END), 0),
    'totalQuantity', COALESCE(SUM(COALESCE(p.quantity, 1)), 0),
    'inStockValue', COALESCE(SUM(CASE WHEN p.status = 'in_stock' THEN COALESCE(p.total_import_cost, p.import_price * COALESCE(p.quantity, 1)) ELSE 0 END), 0),
    'inStockQuantity', COALESCE(SUM(CASE WHEN p.status = 'in_stock' THEN COALESCE(p.quantity, 1) ELSE 0 END), 0),
    'soldValue', COALESCE(SUM(CASE WHEN p.status = 'sold' THEN COALESCE(p.total_import_cost, p.import_price * COALESCE(p.quantity, 1)) ELSE 0 END), 0),
    'soldQuantity', COALESCE(SUM(CASE WHEN p.status = 'sold' THEN COALESCE(p.quantity, 1) ELSE 0 END), 0),
    'returnedValue', COALESCE(SUM(CASE WHEN p.status = 'returned' THEN COALESCE(p.total_import_cost, p.import_price * COALESCE(p.quantity, 1)) ELSE 0 END), 0),
    'returnedQuantity', COALESCE(SUM(CASE WHEN p.status = 'returned' THEN COALESCE(p.quantity, 1) ELSE 0 END), 0)
  ) INTO result
  FROM products p
  JOIN user_roles ur ON ur.tenant_id = p.tenant_id AND ur.user_id = auth.uid()
  WHERE p.tenant_id = _tenant_id
    AND (_branch_id IS NULL OR p.branch_id = _branch_id);

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;
