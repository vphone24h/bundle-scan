-- Fix warranty lookup RPC return type mismatch (export_date is timestamptz in export_receipts)

DROP FUNCTION IF EXISTS public.lookup_warranty_by_imei(text, uuid, text);
CREATE OR REPLACE FUNCTION public.lookup_warranty_by_imei(
  _imei text,
  _tenant_id uuid,
  _ip_address text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid,
  imei text,
  product_name text,
  sku text,
  warranty text,
  sale_price numeric,
  created_at timestamp with time zone,
  branch_name text,
  export_date timestamp with time zone,
  staff_user_id uuid,
  staff_name text,
  branch_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _ip_address IS NOT NULL THEN
    IF NOT public.check_warranty_lookup_limit(_ip_address) THEN
      RAISE EXCEPTION 'Rate limit exceeded. Maximum 50 lookups per hour allowed.';
    END IF;
  END IF;

  INSERT INTO public.warranty_lookup_logs (ip_address, search_type, search_value, tenant_id)
  VALUES (COALESCE(_ip_address, '0.0.0.0'), 'imei', _imei, _tenant_id);

  RETURN QUERY
  WITH matched_customer AS (
    SELECT c.id AS cid
    FROM export_receipt_items eri
    INNER JOIN export_receipts er ON er.id = eri.receipt_id
    INNER JOIN customers c ON c.id = er.customer_id
    WHERE eri.imei = _imei
      AND er.tenant_id = _tenant_id
      AND eri.status = 'sold'
    LIMIT 1
  )
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
  INNER JOIN matched_customer mc ON mc.cid = er.customer_id
  WHERE er.tenant_id = _tenant_id
    AND eri.status = 'sold'
  ORDER BY eri.created_at DESC
  LIMIT 50;
END;
$function$;

DROP FUNCTION IF EXISTS public.lookup_warranty_by_phone(text, uuid, text);
CREATE OR REPLACE FUNCTION public.lookup_warranty_by_phone(
  _phone text,
  _tenant_id uuid,
  _ip_address text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid,
  imei text,
  product_name text,
  sku text,
  warranty text,
  sale_price numeric,
  created_at timestamp with time zone,
  branch_name text,
  export_date timestamp with time zone,
  branch_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _ip_address IS NOT NULL THEN
    IF NOT public.check_warranty_lookup_limit(_ip_address) THEN
      RAISE EXCEPTION 'Rate limit exceeded. Maximum 50 lookups per hour allowed.';
    END IF;
  END IF;

  INSERT INTO public.warranty_lookup_logs (ip_address, search_type, search_value, tenant_id)
  VALUES (COALESCE(_ip_address, '0.0.0.0'), 'phone', _phone, _tenant_id);

  RETURN QUERY
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
    er.branch_id
  FROM export_receipt_items eri
  INNER JOIN export_receipts er ON er.id = eri.receipt_id
  LEFT JOIN branches b ON b.id = er.branch_id
  INNER JOIN customers c ON c.id = er.customer_id
  WHERE c.phone = _phone
    AND c.tenant_id = _tenant_id
    AND er.tenant_id = _tenant_id
    AND eri.status = 'sold'
  ORDER BY eri.created_at DESC
  LIMIT 20;
END;
$function$;