
CREATE OR REPLACE FUNCTION public.search_export_receipts(
  _search text DEFAULT NULL::text,
  _status text DEFAULT NULL::text,
  _date_from text DEFAULT NULL::text,
  _date_to text DEFAULT NULL::text,
  _branch_id uuid DEFAULT NULL::uuid,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 50,
  _customer_source text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, code text, export_date timestamp with time zone, export_date_modified boolean, status text, total_amount numeric, discount_amount numeric, final_amount numeric, paid_amount numeric, remaining_amount numeric, customer_id uuid, branch_id uuid, created_by uuid, sales_staff_id uuid, note text, created_at timestamp with time zone, updated_at timestamp with time zone, tenant_id uuid, customer_name text, customer_phone text, customer_address text, branch_name text, has_more boolean, payment_source text, payment_sources jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _offset integer := (_page - 1) * _page_size;
  _limit integer := _page_size + 1;
  _tenant_id uuid;
BEGIN
  _tenant_id := public.get_user_tenant_id_secure();
  IF _tenant_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    er.id, er.code, er.export_date, er.export_date_modified, er.status,
    er.total_amount, 0::numeric, er.total_amount, er.paid_amount, er.debt_amount,
    er.customer_id, er.branch_id, er.created_by, er.sales_staff_id, er.note,
    er.created_at, er.updated_at, er.tenant_id,
    c.name, c.phone, c.address, b.name,
    (COUNT(*) OVER () > _offset + _page_size) AS has_more,
    (SELECT erp.payment_type FROM public.export_receipt_payments erp WHERE erp.receipt_id = er.id ORDER BY erp.created_at ASC LIMIT 1),
    (SELECT jsonb_agg(jsonb_build_object('id', erp.id, 'receipt_id', erp.receipt_id, 'amount', erp.amount, 'payment_type', erp.payment_type) ORDER BY erp.created_at ASC) FROM public.export_receipt_payments erp WHERE erp.receipt_id = er.id)
  FROM public.export_receipts er
  LEFT JOIN public.customers c ON c.id = er.customer_id
  LEFT JOIN public.branches b ON b.id = er.branch_id
  WHERE er.tenant_id = _tenant_id
    AND (_branch_id IS NULL OR er.branch_id = _branch_id)
    AND (_status IS NULL OR er.status = _status)
    AND (_date_from IS NULL OR er.export_date >= _date_from::timestamptz)
    AND (_date_to IS NULL OR er.export_date <= (_date_to || 'T23:59:59')::timestamptz)
    AND (_customer_source IS NULL OR c.source = _customer_source)
    AND (
      _search IS NULL
      OR er.code ILIKE '%' || _search || '%'
      OR COALESCE(c.name, '') ILIKE '%' || _search || '%'
      OR COALESCE(c.phone, '') ILIKE '%' || _search || '%'
    )
  ORDER BY er.export_date DESC
  OFFSET _offset
  LIMIT _limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_export_receipt_items_paginated(
  _page integer,
  _page_size integer,
  _search text DEFAULT NULL::text,
  _category_id uuid DEFAULT NULL::uuid,
  _branch_id uuid DEFAULT NULL::uuid,
  _customer_source text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, receipt_id uuid, product_id uuid, product_name text, sku text, imei text, category_id uuid, sale_price numeric, quantity numeric, unit text, status text, note text, warranty text, created_at timestamp with time zone, category_name text, receipt_code text, export_date timestamp with time zone, export_date_modified boolean, receipt_branch_id uuid, receipt_customer_id uuid, receipt_created_by uuid, receipt_status text, receipt_sales_staff_id uuid, customer_name text, customer_phone text, branch_name text, has_more boolean, total_count bigint, receipt_note text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid;
  _offset integer;
  _fetch_size integer;
BEGIN
  _tenant_id := public.get_user_tenant_id_secure();
  IF _tenant_id IS NULL THEN RETURN; END IF;

  _offset := (_page - 1) * _page_size;
  _fetch_size := _page_size + 1;

  RETURN QUERY
  WITH filtered_items AS (
    SELECT eri.*, er.export_date AS item_export_date
    FROM export_receipt_items eri
    INNER JOIN export_receipts er ON er.id = eri.receipt_id
    LEFT JOIN customers c0 ON c0.id = er.customer_id
    WHERE er.tenant_id = _tenant_id
      AND (_branch_id IS NULL OR er.branch_id = _branch_id)
      AND (_category_id IS NULL OR eri.category_id = _category_id)
      AND (_customer_source IS NULL OR c0.source = _customer_source)
      AND (_search IS NULL OR (
        eri.product_name ILIKE '%' || _search || '%'
        OR eri.sku ILIKE '%' || _search || '%'
        OR eri.imei ILIKE '%' || _search || '%'
      ))
    ORDER BY er.export_date DESC, eri.created_at DESC
    OFFSET _offset
    LIMIT _fetch_size
  )
  SELECT
    fi.id, fi.receipt_id, fi.product_id, fi.product_name, fi.sku, fi.imei,
    fi.category_id, fi.sale_price, COALESCE(fi.quantity, 1), COALESCE(fi.unit, 'cái'),
    fi.status, fi.note, fi.warranty, fi.created_at,
    cat.name, er2.code, er2.export_date, er2.export_date_modified,
    er2.branch_id, er2.customer_id, er2.created_by, er2.status, er2.sales_staff_id,
    c.name, c.phone, b.name,
    (SELECT COUNT(*) FROM filtered_items) > _page_size,
    (SELECT COUNT(*) FROM filtered_items),
    er2.note
  FROM filtered_items fi
  INNER JOIN export_receipts er2 ON er2.id = fi.receipt_id
  LEFT JOIN categories cat ON cat.id = fi.category_id
  LEFT JOIN customers c ON c.id = er2.customer_id
  LEFT JOIN branches b ON b.id = er2.branch_id
  ORDER BY fi.item_export_date DESC, fi.created_at DESC
  LIMIT _page_size;
END;
$function$;
