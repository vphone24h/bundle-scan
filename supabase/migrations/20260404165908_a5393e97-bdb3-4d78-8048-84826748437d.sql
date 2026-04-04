
CREATE OR REPLACE FUNCTION public.get_import_history_stats(
  _date_from text DEFAULT NULL,
  _date_to text DEFAULT NULL,
  _branch_id uuid DEFAULT NULL,
  _supplier_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _result json;
BEGIN
  SELECT tenant_id INTO _tenant_id
  FROM profiles WHERE user_id = auth.uid();
  
  IF _tenant_id IS NULL THEN
    RETURN '{}'::json;
  END IF;

  SELECT json_build_object(
    'receipt_count', COALESCE(COUNT(*), 0),
    'product_count', COALESCE(
      (SELECT SUM(iri.quantity)
       FROM import_receipt_items iri
       JOIN import_receipts ir2 ON ir2.id = iri.receipt_id
       WHERE ir2.tenant_id = _tenant_id
         AND (_date_from IS NULL OR ir2.import_date >= _date_from::timestamptz)
         AND (_date_to IS NULL OR ir2.import_date <= (_date_to || 'T23:59:59')::timestamptz)
         AND (_branch_id IS NULL OR ir2.branch_id = _branch_id)
         AND (_supplier_id IS NULL OR ir2.supplier_id = _supplier_id)
      ), 0),
    'imei_count', COALESCE(
      (SELECT SUM(iri.quantity)
       FROM import_receipt_items iri
       JOIN import_receipts ir2 ON ir2.id = iri.receipt_id
       WHERE ir2.tenant_id = _tenant_id
         AND iri.imei IS NOT NULL AND iri.imei != ''
         AND (_date_from IS NULL OR ir2.import_date >= _date_from::timestamptz)
         AND (_date_to IS NULL OR ir2.import_date <= (_date_to || 'T23:59:59')::timestamptz)
         AND (_branch_id IS NULL OR ir2.branch_id = _branch_id)
         AND (_supplier_id IS NULL OR ir2.supplier_id = _supplier_id)
      ), 0),
    'non_imei_count', COALESCE(
      (SELECT SUM(iri.quantity)
       FROM import_receipt_items iri
       JOIN import_receipts ir2 ON ir2.id = iri.receipt_id
       WHERE ir2.tenant_id = _tenant_id
         AND (iri.imei IS NULL OR iri.imei = '')
         AND (_date_from IS NULL OR ir2.import_date >= _date_from::timestamptz)
         AND (_date_to IS NULL OR ir2.import_date <= (_date_to || 'T23:59:59')::timestamptz)
         AND (_branch_id IS NULL OR ir2.branch_id = _branch_id)
         AND (_supplier_id IS NULL OR ir2.supplier_id = _supplier_id)
      ), 0)
  ) INTO _result
  FROM import_receipts ir
  WHERE ir.tenant_id = _tenant_id
    AND (_date_from IS NULL OR ir.import_date >= _date_from::timestamptz)
    AND (_date_to IS NULL OR ir.import_date <= (_date_to || 'T23:59:59')::timestamptz)
    AND (_branch_id IS NULL OR ir.branch_id = _branch_id)
    AND (_supplier_id IS NULL OR ir.supplier_id = _supplier_id);

  RETURN _result;
END;
$$;
