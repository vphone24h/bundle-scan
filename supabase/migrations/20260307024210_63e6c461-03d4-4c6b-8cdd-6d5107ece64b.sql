
DROP FUNCTION IF EXISTS public.global_warranty_lookup_by_imei(text, text);
DROP FUNCTION IF EXISTS public.global_warranty_lookup_by_phone(text, text);
DROP FUNCTION IF EXISTS public.lookup_warranty_by_imei(text, uuid, text);
DROP FUNCTION IF EXISTS public.lookup_warranty_by_phone(text, uuid, text);

-- 1. global_warranty_lookup_by_imei
CREATE OR REPLACE FUNCTION public.global_warranty_lookup_by_imei(_imei text, _ip_address text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, imei text, product_name text, sku text, warranty text, sale_price numeric, created_at timestamp with time zone, branch_name text, export_date timestamp with time zone, store_name text, tenant_id uuid, customer_name text, customer_phone text, note text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF _ip_address IS NOT NULL THEN
    IF NOT public.check_warranty_lookup_limit(_ip_address) THEN
      RAISE EXCEPTION 'Rate limit exceeded. Maximum 50 lookups per hour allowed.';
    END IF;
  END IF;
  INSERT INTO public.warranty_lookup_logs (ip_address, search_type, search_value, tenant_id)
  VALUES (COALESCE(_ip_address, '0.0.0.0'), 'imei_global', _imei, NULL);
  RETURN QUERY
  SELECT eri.id, eri.imei, eri.product_name, eri.sku, eri.warranty, eri.sale_price, eri.created_at,
    b.name AS branch_name, er.export_date, t.store_name, er.tenant_id,
    c.name AS customer_name, c.phone AS customer_phone, eri.note
  FROM export_receipt_items eri
  INNER JOIN export_receipts er ON er.id = eri.receipt_id
  INNER JOIN tenants t ON t.id = er.tenant_id
  LEFT JOIN branches b ON b.id = er.branch_id
  INNER JOIN customers c ON c.id = er.customer_id
  WHERE eri.imei = _imei AND eri.status = 'sold'
  ORDER BY er.export_date DESC, eri.created_at DESC
  LIMIT 10;
END;
$function$;

-- 2. global_warranty_lookup_by_phone
CREATE OR REPLACE FUNCTION public.global_warranty_lookup_by_phone(_phone text, _ip_address text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, imei text, product_name text, sku text, warranty text, sale_price numeric, created_at timestamp with time zone, branch_name text, export_date timestamp with time zone, store_name text, tenant_id uuid, customer_name text, customer_phone text, note text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF _ip_address IS NOT NULL THEN
    IF NOT public.check_warranty_lookup_limit(_ip_address) THEN
      RAISE EXCEPTION 'Rate limit exceeded. Maximum 50 lookups per hour allowed.';
    END IF;
  END IF;
  INSERT INTO public.warranty_lookup_logs (ip_address, search_type, search_value, tenant_id)
  VALUES (COALESCE(_ip_address, '0.0.0.0'), 'phone_global', _phone, NULL);
  RETURN QUERY
  SELECT eri.id, eri.imei, eri.product_name, eri.sku, eri.warranty, eri.sale_price, eri.created_at,
    b.name AS branch_name, er.export_date, t.store_name, er.tenant_id,
    c.name AS customer_name, c.phone AS customer_phone, eri.note
  FROM export_receipt_items eri
  INNER JOIN export_receipts er ON er.id = eri.receipt_id
  INNER JOIN tenants t ON t.id = er.tenant_id
  LEFT JOIN branches b ON b.id = er.branch_id
  INNER JOIN customers c ON c.id = er.customer_id
  WHERE c.phone = _phone AND eri.status = 'sold'
  ORDER BY er.export_date DESC, eri.created_at DESC
  LIMIT 50;
END;
$function$;

-- 3. lookup_warranty_by_imei (store-specific)
CREATE OR REPLACE FUNCTION public.lookup_warranty_by_imei(_imei text, _tenant_id uuid, _ip_address text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, imei text, product_name text, sku text, warranty text, sale_price numeric, created_at timestamp with time zone, branch_name text, export_date timestamp with time zone, staff_user_id uuid, staff_name text, branch_id uuid, customer_name text, customer_id uuid, customer_phone text, note text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    WHERE eri.imei = _imei AND er.tenant_id = _tenant_id AND eri.status = 'sold'
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
  INNER JOIN matched_customer mc ON mc.cid = c.id
  WHERE er.tenant_id = _tenant_id AND eri.status = 'sold'
  ORDER BY er.export_date DESC, eri.created_at DESC
  LIMIT 50;
END;
$function$;

-- 4. lookup_warranty_by_phone (store-specific)
CREATE OR REPLACE FUNCTION public.lookup_warranty_by_phone(_phone text, _tenant_id uuid, _ip_address text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, imei text, product_name text, sku text, warranty text, sale_price numeric, created_at timestamp with time zone, branch_name text, export_date timestamp with time zone, staff_user_id uuid, staff_name text, branch_id uuid, customer_name text, customer_id uuid, customer_phone text, note text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  WHERE c.phone = _phone AND c.tenant_id = _tenant_id AND er.tenant_id = _tenant_id AND eri.status = 'sold'
  ORDER BY er.export_date DESC, eri.created_at DESC
  LIMIT 20;
END;
$function$;
