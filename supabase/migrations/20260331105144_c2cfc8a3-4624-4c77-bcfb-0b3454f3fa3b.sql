CREATE OR REPLACE FUNCTION public.search_import_receipts(
  _search text DEFAULT NULL,
  _supplier_id uuid DEFAULT NULL,
  _date_from text DEFAULT NULL,
  _date_to text DEFAULT NULL,
  _branch_id uuid DEFAULT NULL,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 500
)
RETURNS TABLE(
  id uuid,
  code text,
  import_date timestamptz,
  total_amount numeric,
  paid_amount numeric,
  remaining_amount numeric,
  supplier_id uuid,
  branch_id uuid,
  created_by uuid,
  note text,
  created_at timestamptz,
  updated_at timestamptz,
  tenant_id uuid,
  supplier_name text,
  branch_name text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _offset integer := (_page - 1) * _page_size;
  _tenant_id uuid;
BEGIN
  _tenant_id := public.get_user_tenant_id_secure();

  IF _tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ir.id,
    ir.code,
    ir.import_date,
    ir.total_amount,
    ir.paid_amount,
    ir.debt_amount,
    ir.supplier_id,
    ir.branch_id,
    ir.created_by,
    ir.note,
    ir.created_at,
    ir.updated_at,
    ir.tenant_id,
    s.name AS supplier_name,
    b.name AS branch_name,
    COUNT(*) OVER () AS total_count
  FROM public.import_receipts ir
  LEFT JOIN public.suppliers s ON s.id = ir.supplier_id
  LEFT JOIN public.branches b ON b.id = ir.branch_id
  WHERE ir.tenant_id = _tenant_id
    AND (_branch_id IS NULL OR ir.branch_id = _branch_id)
    AND (_supplier_id IS NULL OR ir.supplier_id = _supplier_id)
    AND (_date_from IS NULL OR ir.import_date >= _date_from::timestamptz)
    AND (_date_to IS NULL OR ir.import_date <= (_date_to || 'T23:59:59')::timestamptz)
    AND (
      _search IS NULL
      OR ir.code ILIKE '%' || _search || '%'
      OR COALESCE(s.name, '') ILIKE '%' || _search || '%'
    )
  ORDER BY ir.import_date DESC
  OFFSET _offset
  LIMIT _page_size;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_export_receipts(
  _search text DEFAULT NULL,
  _status text DEFAULT NULL,
  _date_from text DEFAULT NULL,
  _date_to text DEFAULT NULL,
  _branch_id uuid DEFAULT NULL,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  code text,
  export_date timestamptz,
  export_date_modified boolean,
  status text,
  total_amount numeric,
  discount_amount numeric,
  final_amount numeric,
  paid_amount numeric,
  remaining_amount numeric,
  customer_id uuid,
  branch_id uuid,
  created_by uuid,
  sales_staff_id uuid,
  note text,
  created_at timestamptz,
  updated_at timestamptz,
  tenant_id uuid,
  customer_name text,
  customer_phone text,
  customer_address text,
  branch_name text,
  has_more boolean,
  payment_source text,
  payment_sources jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _offset integer := (_page - 1) * _page_size;
  _limit integer := _page_size + 1;
  _tenant_id uuid;
BEGIN
  _tenant_id := public.get_user_tenant_id_secure();

  IF _tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    er.id,
    er.code,
    er.export_date,
    er.export_date_modified,
    er.status,
    er.total_amount,
    0::numeric AS discount_amount,
    er.total_amount AS final_amount,
    er.paid_amount,
    er.debt_amount,
    er.customer_id,
    er.branch_id,
    er.created_by,
    er.sales_staff_id,
    er.note,
    er.created_at,
    er.updated_at,
    er.tenant_id,
    c.name AS customer_name,
    c.phone AS customer_phone,
    c.address AS customer_address,
    b.name AS branch_name,
    (COUNT(*) OVER () > _offset + _page_size) AS has_more,
    (
      SELECT erp.payment_type
      FROM public.export_receipt_payments erp
      WHERE erp.receipt_id = er.id
      ORDER BY erp.created_at ASC
      LIMIT 1
    ) AS payment_source,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', erp.id,
          'receipt_id', erp.receipt_id,
          'amount', erp.amount,
          'payment_type', erp.payment_type
        )
        ORDER BY erp.created_at ASC
      )
      FROM public.export_receipt_payments erp
      WHERE erp.receipt_id = er.id
    ) AS payment_sources
  FROM public.export_receipts er
  LEFT JOIN public.customers c ON c.id = er.customer_id
  LEFT JOIN public.branches b ON b.id = er.branch_id
  WHERE er.tenant_id = _tenant_id
    AND (_branch_id IS NULL OR er.branch_id = _branch_id)
    AND (_status IS NULL OR er.status = _status)
    AND (_date_from IS NULL OR er.export_date >= _date_from::timestamptz)
    AND (_date_to IS NULL OR er.export_date <= (_date_to || 'T23:59:59')::timestamptz)
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
$$;