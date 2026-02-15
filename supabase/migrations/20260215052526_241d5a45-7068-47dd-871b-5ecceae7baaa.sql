-- RPC function to check getting started status in a single query
CREATE OR REPLACE FUNCTION public.check_getting_started_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  result jsonb;
BEGIN
  SELECT pu.tenant_id INTO _tenant_id
  FROM platform_users pu
  WHERE pu.user_id = auth.uid()
  LIMIT 1;

  IF _tenant_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'category', EXISTS(SELECT 1 FROM categories WHERE tenant_id = _tenant_id LIMIT 1),
    'supplier', EXISTS(SELECT 1 FROM suppliers WHERE tenant_id = _tenant_id LIMIT 1),
    'import', EXISTS(SELECT 1 FROM import_receipts WHERE tenant_id = _tenant_id LIMIT 1),
    'product', EXISTS(SELECT 1 FROM products WHERE tenant_id = _tenant_id LIMIT 1),
    'customer', EXISTS(SELECT 1 FROM customers WHERE tenant_id = _tenant_id LIMIT 1),
    'export', EXISTS(SELECT 1 FROM export_receipts WHERE tenant_id = _tenant_id LIMIT 1),
    'landing', EXISTS(SELECT 1 FROM tenant_landing_settings WHERE tenant_id = _tenant_id LIMIT 1)
  ) INTO result;

  RETURN result;
END;
$$;