
CREATE OR REPLACE FUNCTION public.get_export_history_stats(
  _date_from text DEFAULT NULL,
  _date_to text DEFAULT NULL,
  _branch_id uuid DEFAULT NULL,
  _status text DEFAULT NULL
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
    'receipt_count', COALESCE(COUNT(*) FILTER (WHERE er.status NOT IN ('cancelled','full_return')), 0),
    'total_revenue', COALESCE(SUM(er.total_amount) FILTER (WHERE er.status NOT IN ('cancelled','full_return')), 0),
    'return_revenue', COALESCE(
      (SELECT SUM(eri.sale_price * eri.quantity)
       FROM export_receipt_items eri
       JOIN export_receipts er2 ON er2.id = eri.receipt_id
       WHERE er2.tenant_id = _tenant_id
         AND eri.status = 'returned'
         AND (_date_from IS NULL OR er2.export_date >= _date_from::timestamptz)
         AND (_date_to IS NULL OR er2.export_date <= (_date_to || 'T23:59:59')::timestamptz)
         AND (_branch_id IS NULL OR er2.branch_id = _branch_id)
         AND (_status IS NULL OR er2.status = _status)
      ), 0),
    'product_count', COALESCE(
      (SELECT SUM(eri.quantity)
       FROM export_receipt_items eri
       JOIN export_receipts er2 ON er2.id = eri.receipt_id
       WHERE er2.tenant_id = _tenant_id
         AND eri.status != 'returned'
         AND (_date_from IS NULL OR er2.export_date >= _date_from::timestamptz)
         AND (_date_to IS NULL OR er2.export_date <= (_date_to || 'T23:59:59')::timestamptz)
         AND (_branch_id IS NULL OR er2.branch_id = _branch_id)
         AND (_status IS NULL OR er2.status = _status)
      ), 0)
  ) INTO _result
  FROM export_receipts er
  WHERE er.tenant_id = _tenant_id
    AND (_date_from IS NULL OR er.export_date >= _date_from::timestamptz)
    AND (_date_to IS NULL OR er.export_date <= (_date_to || 'T23:59:59')::timestamptz)
    AND (_branch_id IS NULL OR er.branch_id = _branch_id)
    AND (_status IS NULL OR er.status = _status);

  RETURN _result;
END;
$$;
