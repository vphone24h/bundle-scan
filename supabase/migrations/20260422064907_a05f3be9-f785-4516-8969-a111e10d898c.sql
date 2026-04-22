
DROP FUNCTION IF EXISTS public.lookup_warranty_by_imei(TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.lookup_warranty_by_imei(
  _imei TEXT,
  _tenant_id UUID,
  _ip_address TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  imei TEXT,
  product_name TEXT,
  sku TEXT,
  warranty TEXT,
  sale_price NUMERIC,
  created_at TIMESTAMPTZ,
  branch_name TEXT,
  export_date TIMESTAMPTZ,
  staff_user_id UUID,
  staff_name TEXT,
  branch_id UUID,
  customer_name TEXT,
  customer_id UUID,
  customer_phone TEXT,
  note TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _ip_address IS NOT NULL THEN
    IF NOT public.check_warranty_lookup_limit(_ip_address) THEN
      RAISE EXCEPTION 'Rate limit exceeded. Maximum 50 lookups per hour allowed.';
    END IF;
  END IF;
  INSERT INTO public.warranty_lookup_logs (ip_address, search_type, search_value, tenant_id)
  VALUES (COALESCE(_ip_address, '0.0.0.0'), 'imei', _imei, _tenant_id);
  RETURN QUERY
  WITH latest_sale AS (
    SELECT er.customer_id AS cid
    FROM export_receipt_items eri
    INNER JOIN export_receipts er ON er.id = eri.receipt_id
    WHERE eri.imei = _imei AND er.tenant_id = _tenant_id AND eri.status = 'sold'
    ORDER BY er.export_date DESC, eri.created_at DESC
    LIMIT 1
  )
  SELECT eri.id, eri.imei, eri.product_name, eri.sku, eri.warranty, eri.sale_price, eri.created_at,
    b.name AS branch_name, er.export_date,
    COALESCE(er.sales_staff_id, er.created_by) AS staff_user_id,
    p.display_name AS staff_name, er.branch_id,
    c.name AS customer_name, c.id AS customer_id, c.phone AS customer_phone, eri.note
  FROM export_receipt_items eri
  INNER JOIN export_receipts er ON er.id = eri.receipt_id
  LEFT JOIN branches b ON b.id = er.branch_id
  LEFT JOIN profiles p ON p.user_id = COALESCE(er.sales_staff_id, er.created_by)
  INNER JOIN customers c ON c.id = er.customer_id
  INNER JOIN latest_sale ls ON ls.cid = c.id
  WHERE er.tenant_id = _tenant_id AND eri.status = 'sold'
  ORDER BY er.export_date DESC, eri.created_at DESC
  LIMIT 50;
END;
$$;
