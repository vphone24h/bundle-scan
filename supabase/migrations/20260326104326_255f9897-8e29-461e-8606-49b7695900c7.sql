
CREATE OR REPLACE FUNCTION public.backfill_warehouse_snapshots(_tenant_id TEXT, _days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d DATE;
  inv_val NUMERIC;
  cash_val NUMERIC;
  cust_debt NUMERIC;
  supp_debt NUMERIC;
  inserted INT := 0;
  tid UUID := _tenant_id::UUID;
BEGIN
  FOR d IN SELECT generate_series(
    CURRENT_DATE - (_days || ' days')::INTERVAL,
    CURRENT_DATE - INTERVAL '1 day',
    '1 day'::INTERVAL
  )::DATE
  LOOP
    IF EXISTS (
      SELECT 1 FROM warehouse_value_snapshots 
      WHERE tenant_id = _tenant_id AND snapshot_date = d AND branch_id IS NULL
    ) THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(
      p.import_price * GREATEST(
        (SELECT COALESCE(SUM(pi.quantity), 0) FROM product_imports pi 
         WHERE pi.product_id = p.id AND pi.import_date::DATE <= d)
        -
        (SELECT COALESCE(SUM(ei.quantity), 0) FROM export_receipt_items ei 
         JOIN export_receipts er ON er.id = ei.receipt_id 
         WHERE ei.product_id = p.id AND er.tenant_id = tid
         AND er.created_at::DATE <= d)
      , 0)
    ), 0) INTO inv_val
    FROM products p 
    WHERE p.tenant_id = tid
      AND p.import_price IS NOT NULL AND p.import_price > 0;

    SELECT COALESCE(SUM(
      CASE WHEN type = 'income' THEN amount ELSE -amount END
    ), 0) INTO cash_val
    FROM cash_book 
    WHERE tenant_id = tid AND transaction_date::DATE <= d;

    SELECT COALESCE(SUM(
      CASE WHEN payment_type = 'debt_increase' THEN amount 
           WHEN payment_type = 'debt_payment' THEN -amount 
           ELSE 0 END
    ), 0) INTO cust_debt
    FROM debt_payments 
    WHERE tenant_id = tid AND entity_type = 'customer' AND created_at::DATE <= d;

    SELECT COALESCE(SUM(
      CASE WHEN payment_type = 'debt_increase' THEN amount 
           WHEN payment_type = 'debt_payment' THEN -amount 
           ELSE 0 END
    ), 0) INTO supp_debt
    FROM debt_payments 
    WHERE tenant_id = tid AND entity_type = 'supplier' AND created_at::DATE <= d;

    IF cust_debt < 0 THEN cust_debt := 0; END IF;
    IF supp_debt < 0 THEN supp_debt := 0; END IF;

    INSERT INTO warehouse_value_snapshots (
      tenant_id, branch_id, snapshot_date, 
      inventory_value, cash_balance, customer_debt, supplier_debt, total_value
    ) VALUES (
      _tenant_id, NULL, d,
      inv_val, cash_val, cust_debt, supp_debt,
      inv_val + cash_val + cust_debt - supp_debt
    );
    
    inserted := inserted + 1;
  END LOOP;

  RETURN inserted;
END;
$$;
