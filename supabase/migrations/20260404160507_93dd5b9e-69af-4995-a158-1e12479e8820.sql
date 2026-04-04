
CREATE OR REPLACE FUNCTION public.get_import_receipt_details(_receipt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'receipt', (
      SELECT jsonb_build_object(
        'id', r.id, 'code', r.code, 'import_date', r.import_date,
        'total_amount', r.total_amount, 'paid_amount', r.paid_amount,
        'debt_amount', r.debt_amount, 'status', r.status, 'note', r.note,
        'supplier_id', r.supplier_id, 'branch_id', r.branch_id,
        'created_by', r.created_by, 'created_by_name', r.created_by_name,
        'suppliers', CASE WHEN s.id IS NOT NULL THEN jsonb_build_object('name', s.name) ELSE NULL END,
        'branches', CASE WHEN b.id IS NOT NULL THEN jsonb_build_object('name', b.name) ELSE NULL END
      )
      FROM import_receipts r
      LEFT JOIN suppliers s ON s.id = r.supplier_id
      LEFT JOIN branches b ON b.id = r.branch_id
      WHERE r.id = _receipt_id
    ),
    'payments', COALESCE((
      SELECT jsonb_agg(to_jsonb(rp))
      FROM receipt_payments rp
      WHERE rp.receipt_id = _receipt_id
    ), '[]'::jsonb),
    'product_imports', COALESCE((
      SELECT jsonb_agg(to_jsonb(pi_row))
      FROM (
        SELECT pi.id AS pi_id, pi.product_id, pi.import_price AS pi_import_price, pi.quantity AS pi_quantity
        FROM product_imports pi
        WHERE pi.import_receipt_id = _receipt_id
      ) pi_row
    ), '[]'::jsonb),
    'products', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id, 'name', p.name, 'sku', p.sku, 'imei', p.imei,
          'import_price', p.import_price, 'quantity', p.quantity,
          'unit', p.unit, 'status', p.status, 'category_id', p.category_id,
          'categories', CASE WHEN c.id IS NOT NULL THEN jsonb_build_object('name', c.name) ELSE NULL END
        )
      )
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.import_receipt_id = _receipt_id
    ), '[]'::jsonb)
  ) INTO result;
  
  RETURN result;
END;
$$;
