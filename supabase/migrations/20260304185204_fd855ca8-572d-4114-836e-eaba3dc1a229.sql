
-- 1. Fix IMEI products: total_import_cost should equal import_price for IMEI items
UPDATE products 
SET total_import_cost = import_price 
WHERE imei IS NOT NULL 
  AND (total_import_cost IS NULL OR total_import_cost != import_price);

-- 2. Update get_import_summary_stats to use same formula as dashboard
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
    'totalImportValue', COALESCE(SUM(
      CASE 
        WHEN imei IS NOT NULL THEN COALESCE(import_price, 0)
        ELSE COALESCE(total_import_cost, COALESCE(import_price, 0) * COALESCE(quantity, 1))
      END
    ), 0),
    'totalQuantity', COALESCE(SUM(COALESCE(quantity, 1)), 0),
    'inStockValue', COALESCE(SUM(CASE WHEN status = 'in_stock' THEN
      CASE 
        WHEN imei IS NOT NULL THEN COALESCE(import_price, 0)
        ELSE COALESCE(total_import_cost, COALESCE(import_price, 0) * COALESCE(quantity, 1))
      END
    ELSE 0 END), 0),
    'inStockQuantity', COALESCE(SUM(CASE WHEN status = 'in_stock' THEN COALESCE(quantity, 1) ELSE 0 END), 0),
    'soldValue', COALESCE(SUM(CASE WHEN status = 'sold' THEN
      CASE 
        WHEN imei IS NOT NULL THEN COALESCE(import_price, 0)
        ELSE COALESCE(total_import_cost, COALESCE(import_price, 0) * COALESCE(quantity, 1))
      END
    ELSE 0 END), 0),
    'soldQuantity', COALESCE(SUM(CASE WHEN status = 'sold' THEN COALESCE(quantity, 1) ELSE 0 END), 0),
    'returnedValue', COALESCE(SUM(CASE WHEN status = 'returned' THEN
      CASE 
        WHEN imei IS NOT NULL THEN COALESCE(import_price, 0)
        ELSE COALESCE(total_import_cost, COALESCE(import_price, 0) * COALESCE(quantity, 1))
      END
    ELSE 0 END), 0),
    'returnedQuantity', COALESCE(SUM(CASE WHEN status = 'returned' THEN COALESCE(quantity, 1) ELSE 0 END), 0)
  ) INTO result
  FROM products p
  JOIN user_roles ur ON ur.tenant_id = p.tenant_id AND ur.user_id = auth.uid()
  WHERE p.tenant_id = _tenant_id
    AND (_branch_id IS NULL OR p.branch_id = _branch_id);

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;
