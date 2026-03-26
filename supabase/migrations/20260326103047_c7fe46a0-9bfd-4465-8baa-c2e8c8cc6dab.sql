
-- Function to backfill historical warehouse value snapshots
-- It calculates backwards from current values using transaction history
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
BEGIN
  FOR d IN SELECT generate_series(
    CURRENT_DATE - (_days || ' days')::INTERVAL,
    CURRENT_DATE - INTERVAL '1 day',
    '1 day'::INTERVAL
  )::DATE
  LOOP
    -- Skip if snapshot already exists
    IF EXISTS (
      SELECT 1 FROM warehouse_value_snapshots 
      WHERE tenant_id = _tenant_id AND snapshot_date = d AND branch_id IS NULL
    ) THEN
      CONTINUE;
    END IF;

    -- Inventory value on date d:
    -- Sum of (import cost) for imports on or before d, minus exports on or before d
    SELECT COALESCE(SUM(
      CASE WHEN p.import_price IS NOT NULL AND p.import_price > 0 
        THEN p.import_price * COALESCE(
          (SELECT COALESCE(SUM(ii.quantity), 0) FROM import_receipt_items ii 
           JOIN import_receipts ir ON ir.id = ii.import_receipt_id 
           WHERE ii.product_id = p.id AND ir.tenant_id = _tenant_id 
           AND ir.created_at::DATE <= d)
          -
          (SELECT COALESCE(SUM(ei.quantity), 0) FROM export_receipt_items ei 
           JOIN export_receipts er ON er.id = ei.export_receipt_id 
           WHERE ei.product_id = p.id AND er.tenant_id = _tenant_id 
           AND er.created_at::DATE <= d)
        , 0)
      ELSE 0 END
    ), 0) INTO inv_val
    FROM products p WHERE p.tenant_id = _tenant_id;

    -- Cash balance on date d
    SELECT COALESCE(SUM(
      CASE WHEN type = 'income' THEN amount ELSE -amount END
    ), 0) INTO cash_val
    FROM cash_book 
    WHERE tenant_id = _tenant_id AND transaction_date::DATE <= d;

    -- Customer debt on date d (approximation: use current debt)
    -- Debt is harder to backfill accurately, use current values as rough estimate
    SELECT COALESCE(SUM(
      CASE WHEN entity_type = 'customer' THEN 
        CASE WHEN payment_type = 'debt_increase' THEN amount 
             WHEN payment_type = 'debt_payment' THEN -amount 
             ELSE 0 END
      ELSE 0 END
    ), 0) INTO cust_debt
    FROM debt_payments WHERE tenant_id = _tenant_id AND created_at::DATE <= d;

    SELECT COALESCE(SUM(
      CASE WHEN entity_type = 'supplier' THEN 
        CASE WHEN payment_type = 'debt_increase' THEN amount 
             WHEN payment_type = 'debt_payment' THEN -amount 
             ELSE 0 END
      ELSE 0 END
    ), 0) INTO supp_debt
    FROM debt_payments WHERE tenant_id = _tenant_id AND created_at::DATE <= d;

    -- Ensure non-negative
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
