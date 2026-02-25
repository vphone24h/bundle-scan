
-- Add sales_staff_id column to export_receipts
ALTER TABLE public.export_receipts 
ADD COLUMN sales_staff_id uuid REFERENCES auth.users(id) DEFAULT NULL;

-- Backfill: set sales_staff_id = created_by for existing records
UPDATE public.export_receipts 
SET sales_staff_id = created_by 
WHERE sales_staff_id IS NULL AND created_by IS NOT NULL;

-- Update warranty lookup by phone to use sales_staff_id
CREATE OR REPLACE FUNCTION public.lookup_warranty_by_phone(_phone text, _tenant_id uuid, _ip_address text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, imei text, product_name text, sku text, warranty text, sale_price numeric, created_at timestamp with time zone, branch_name text, export_date timestamp with time zone, staff_user_id uuid, staff_name text, branch_id uuid, customer_name text, customer_id uuid, customer_phone text)
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
    COALESCE(er.sales_staff_id, er.created_by) AS staff_user_id,
    p.display_name AS staff_name,
    er.branch_id,
    c.name AS customer_name,
    c.id AS customer_id,
    c.phone AS customer_phone
  FROM export_receipt_items eri
  INNER JOIN export_receipts er ON er.id = eri.receipt_id
  LEFT JOIN branches b ON b.id = er.branch_id
  LEFT JOIN profiles p ON p.user_id = COALESCE(er.sales_staff_id, er.created_by)
  INNER JOIN customers c ON c.id = er.customer_id
  WHERE c.phone = _phone
    AND c.tenant_id = _tenant_id
    AND er.tenant_id = _tenant_id
    AND eri.status = 'sold'
  ORDER BY eri.created_at DESC
  LIMIT 20;
END;
$function$;

-- Update warranty lookup by IMEI to use sales_staff_id
CREATE OR REPLACE FUNCTION public.lookup_warranty_by_imei(_imei text, _tenant_id uuid, _ip_address text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, imei text, product_name text, sku text, warranty text, sale_price numeric, created_at timestamp with time zone, branch_name text, export_date timestamp with time zone, staff_user_id uuid, staff_name text, branch_id uuid, customer_name text, customer_id uuid, customer_phone text)
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
    COALESCE(er.sales_staff_id, er.created_by) AS staff_user_id,
    p.display_name AS staff_name,
    er.branch_id,
    c.name AS customer_name,
    c.id AS customer_id,
    c.phone AS customer_phone
  FROM export_receipt_items eri
  INNER JOIN export_receipts er ON er.id = eri.receipt_id
  LEFT JOIN branches b ON b.id = er.branch_id
  LEFT JOIN profiles p ON p.user_id = COALESCE(er.sales_staff_id, er.created_by)
  INNER JOIN customers c ON c.id = er.customer_id
  INNER JOIN matched_customer mc ON mc.cid = c.id
  WHERE er.tenant_id = _tenant_id
    AND eri.status = 'sold'
  ORDER BY eri.created_at DESC
  LIMIT 50;
END;
$function$;

-- Update KPI stats to use sales_staff_id
CREATE OR REPLACE FUNCTION public.get_staff_kpi_stats(p_tenant_id uuid, p_user_id uuid, p_start_date date, p_end_date date)
 RETURNS TABLE(total_revenue numeric, total_orders integer, total_customers integer, new_customers integer, conversion_rate numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH staff_sales AS (
    SELECT 
      COALESCE(SUM(er.total_amount), 0) as revenue,
      COUNT(DISTINCT er.id) as orders
    FROM export_receipts er
    WHERE er.tenant_id = p_tenant_id
      AND COALESCE(er.sales_staff_id, er.created_by) = p_user_id
      AND er.status = 'completed'
      AND er.export_date >= p_start_date
      AND er.export_date < p_end_date + INTERVAL '1 day'
  ),
  staff_customers AS (
    SELECT 
      COUNT(DISTINCT c.id) as total,
      COUNT(DISTINCT CASE WHEN c.created_at >= p_start_date AND c.created_at < p_end_date + INTERVAL '1 day' THEN c.id END) as new_count
    FROM customers c
    WHERE c.tenant_id = p_tenant_id
      AND c.assigned_staff_id = p_user_id
  ),
  staff_care AS (
    SELECT
      COUNT(CASE WHEN status = 'completed' THEN 1 END)::NUMERIC as completed,
      COUNT(*)::NUMERIC as total_tasks
    FROM customer_care_schedules
    WHERE tenant_id = p_tenant_id
      AND assigned_staff_id = p_user_id
      AND scheduled_date >= p_start_date
      AND scheduled_date <= p_end_date
  )
  SELECT 
    ss.revenue,
    ss.orders::INTEGER,
    sc.total::INTEGER,
    sc.new_count::INTEGER,
    CASE WHEN care.total_tasks > 0 THEN ROUND((care.completed / care.total_tasks) * 100, 2) ELSE 0 END
  FROM staff_sales ss
  CROSS JOIN staff_customers sc
  CROSS JOIN staff_care care;
END;
$function$;
