
-- Drop existing functions first (return type changed)
DROP FUNCTION IF EXISTS public.lookup_warranty_by_imei(text, uuid);
DROP FUNCTION IF EXISTS public.lookup_warranty_by_phone(text, uuid);

-- Recreate with staff info columns
CREATE OR REPLACE FUNCTION public.lookup_warranty_by_imei(_imei text, _tenant_id uuid)
 RETURNS TABLE(id uuid, imei text, product_name text, sku text, warranty text, sale_price numeric, created_at timestamp with time zone, branch_name text, export_date timestamp with time zone, staff_user_id uuid, staff_name text, branch_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    er.branch_id
  FROM export_receipt_items eri
  INNER JOIN export_receipts er ON er.id = eri.receipt_id
  LEFT JOIN branches b ON b.id = er.branch_id
  LEFT JOIN profiles p ON p.user_id = er.created_by
  WHERE eri.imei = _imei
    AND er.tenant_id = _tenant_id
    AND eri.status = 'sold'
  ORDER BY eri.created_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.lookup_warranty_by_phone(_phone text, _tenant_id uuid)
 RETURNS TABLE(id uuid, imei text, product_name text, sku text, warranty text, sale_price numeric, created_at timestamp with time zone, branch_name text, export_date timestamp with time zone, staff_user_id uuid, staff_name text, branch_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    er.branch_id
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
