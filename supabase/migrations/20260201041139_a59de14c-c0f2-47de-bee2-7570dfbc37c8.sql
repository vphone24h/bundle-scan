-- =====================================================
-- SECURITY FIX: Remove overly permissive public RLS policies
-- for warranty lookup and replace with secure function
-- =====================================================

-- 1. Drop the dangerous public SELECT policies that expose customer data
DROP POLICY IF EXISTS "Public can lookup customers by phone for warranty" ON public.customers;
DROP POLICY IF EXISTS "Public can view for warranty lookup" ON public.export_receipts;
DROP POLICY IF EXISTS "Public can view for warranty lookup" ON public.export_receipt_items;

-- 2. Create a secure SECURITY DEFINER function for warranty lookup by IMEI
-- This function ONLY returns warranty-related data, NOT customer phone numbers
CREATE OR REPLACE FUNCTION public.lookup_warranty_by_imei(
  _imei TEXT,
  _tenant_id UUID
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
  export_date TIMESTAMPTZ
)
LANGUAGE sql
STABLE
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
    er.export_date
  FROM export_receipt_items eri
  INNER JOIN export_receipts er ON er.id = eri.receipt_id
  LEFT JOIN branches b ON b.id = er.branch_id
  WHERE eri.imei = _imei
    AND er.tenant_id = _tenant_id
    AND eri.status = 'sold'
  ORDER BY eri.created_at DESC
  LIMIT 1
$$;

-- 3. Create a secure SECURITY DEFINER function for warranty lookup by phone
-- This function looks up customer first, then returns warranty data WITHOUT exposing phone
CREATE OR REPLACE FUNCTION public.lookup_warranty_by_phone(
  _phone TEXT,
  _tenant_id UUID
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
  export_date TIMESTAMPTZ
)
LANGUAGE sql
STABLE
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
    er.export_date
  FROM export_receipt_items eri
  INNER JOIN export_receipts er ON er.id = eri.receipt_id
  LEFT JOIN branches b ON b.id = er.branch_id
  INNER JOIN customers c ON c.id = er.customer_id
  WHERE c.phone = _phone
    AND c.tenant_id = _tenant_id
    AND er.tenant_id = _tenant_id
    AND eri.status = 'sold'
  ORDER BY eri.created_at DESC
  LIMIT 20
$$;

-- 4. Grant execute permission to anon role for public warranty lookup
GRANT EXECUTE ON FUNCTION public.lookup_warranty_by_imei(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_warranty_by_phone(TEXT, UUID) TO anon;