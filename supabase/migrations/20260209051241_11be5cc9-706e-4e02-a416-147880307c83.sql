
-- Drop existing functions first (return type changed)
DROP FUNCTION IF EXISTS public.lookup_warranty_by_imei(text, uuid);
DROP FUNCTION IF EXISTS public.lookup_warranty_by_phone(text, uuid);

-- Recreate lookup_warranty_by_imei with customer_phone
CREATE FUNCTION public.lookup_warranty_by_imei(_imei text, _tenant_id uuid)
RETURNS TABLE(
  id uuid,
  imei text,
  product_name text,
  sku text,
  warranty text,
  sale_price numeric,
  created_at timestamptz,
  branch_name text,
  export_date date,
  staff_user_id uuid,
  staff_name text,
  branch_id uuid,
  customer_name text,
  customer_id uuid,
  customer_phone text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    eri.id,
    eri.imei,
    eri.product_name,
    eri.sku,
    eri.warranty,
    eri.sale_price,
    eri.created_at,
    b.name AS branch_name,
    er.export_date,
    er.created_by AS staff_user_id,
    p.display_name AS staff_name,
    er.branch_id,
    c.name AS customer_name,
    c.id AS customer_id,
    c.phone AS customer_phone
  FROM export_receipt_items eri
  INNER JOIN export_receipts er ON er.id = eri.receipt_id
  LEFT JOIN branches b ON b.id = er.branch_id
  LEFT JOIN profiles p ON p.user_id = er.created_by
  INNER JOIN customers c ON c.id = er.customer_id
  WHERE eri.imei = _imei
    AND er.tenant_id = _tenant_id
    AND eri.status = 'sold'
  ORDER BY eri.created_at DESC
  LIMIT 5
$$;

-- Recreate lookup_warranty_by_phone with customer_phone
CREATE FUNCTION public.lookup_warranty_by_phone(_phone text, _tenant_id uuid)
RETURNS TABLE(
  id uuid,
  imei text,
  product_name text,
  sku text,
  warranty text,
  sale_price numeric,
  created_at timestamptz,
  branch_name text,
  export_date date,
  staff_user_id uuid,
  staff_name text,
  branch_id uuid,
  customer_name text,
  customer_id uuid,
  customer_phone text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    eri.id,
    eri.imei,
    eri.product_name,
    eri.sku,
    eri.warranty,
    eri.sale_price,
    eri.created_at,
    b.name AS branch_name,
    er.export_date,
    er.created_by AS staff_user_id,
    p.display_name AS staff_name,
    er.branch_id,
    c.name AS customer_name,
    c.id AS customer_id,
    c.phone AS customer_phone
  FROM export_receipt_items eri
  INNER JOIN export_receipts er ON er.id = eri.receipt_id
  LEFT JOIN branches b ON b.id = er.branch_id
  LEFT JOIN profiles p ON p.user_id = er.created_by
  INNER JOIN customers c ON c.id = er.customer_id
  WHERE c.phone = _phone
    AND c.tenant_id = _tenant_id
    AND er.tenant_id = _tenant_id
    AND eri.status = 'sold'
  ORDER BY eri.created_at DESC
  LIMIT 20
$$;
