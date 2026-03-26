-- Drop old function
DROP FUNCTION IF EXISTS public.backfill_warehouse_snapshots(text, integer);

-- Create improved backfill function using actual data
CREATE OR REPLACE FUNCTION public.backfill_warehouse_snapshots_v2(_tid UUID)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  d DATE;
  inv_val NUMERIC;
  cash_val NUMERIC;
  cust_debt NUMERIC;
  supp_debt NUMERIC;
  inserted INT := 0;
  start_date DATE;
  tid_text TEXT := _tid::TEXT;
BEGIN
  -- Find earliest activity date
  SELECT LEAST(
    COALESCE((SELECT MIN(import_date::DATE) FROM products WHERE tenant_id = _tid AND import_date IS NOT NULL), CURRENT_DATE),
    COALESCE((SELECT MIN(transaction_date::DATE) FROM cash_book WHERE tenant_id = tid_text), CURRENT_DATE),
    COALESCE((SELECT MIN(created_at::DATE) FROM debt_payments WHERE tenant_id = tid_text), CURRENT_DATE)
  ) INTO start_date;

  FOR d IN SELECT generate_series(start_date, CURRENT_DATE - 1, '1 day'::INTERVAL)::DATE
  LOOP
    -- Skip if already exists
    IF EXISTS (
      SELECT 1 FROM warehouse_value_snapshots 
      WHERE tenant_id = tid_text AND snapshot_date = d AND branch_id IS NULL
    ) THEN
      CONTINUE;
    END IF;

    -- === INVENTORY VALUE ===
    -- IMEI products: each row = 1 unit, in stock if imported <= d AND not yet sold by d
    SELECT COALESCE(SUM(p.import_price), 0) INTO inv_val
    FROM products p
    WHERE p.tenant_id = _tid
      AND p.imei IS NOT NULL AND p.imei != ''
      AND p.import_date::DATE <= d
      AND p.import_price IS NOT NULL AND p.import_price > 0
      AND p.status != 'deleted'
      AND NOT EXISTS (
        SELECT 1 FROM export_receipt_items ei
        JOIN export_receipts er ON er.id = ei.receipt_id
        WHERE ei.product_id = p.id AND er.created_at::DATE <= d
      );

    -- Non-IMEI products: stock = imported - exported up to day d
    inv_val := inv_val + COALESCE((
      SELECT SUM(
        GREATEST(
          (SELECT COALESCE(SUM(pi.quantity), 0) FROM product_imports pi WHERE pi.product_id = p.id AND pi.import_date::DATE <= d)
          -
          (SELECT COALESCE(SUM(ei.quantity), 0) FROM export_receipt_items ei JOIN export_receipts er ON er.id = ei.receipt_id WHERE ei.product_id = p.id AND er.created_at::DATE <= d)
        , 0) * p.import_price
      )
      FROM products p
      WHERE p.tenant_id = _tid
        AND (p.imei IS NULL OR p.imei = '')
        AND p.import_price IS NOT NULL AND p.import_price > 0
        AND p.status != 'deleted'
    ), 0);

    -- === CASH BALANCE ===
    SELECT COALESCE(SUM(
      CASE WHEN type = 'income' THEN amount ELSE -amount END
    ), 0) INTO cash_val
    FROM cash_book 
    WHERE tenant_id = tid_text AND transaction_date::DATE <= d;

    -- === CUSTOMER DEBT ===
    SELECT COALESCE(SUM(
      CASE WHEN payment_type = 'debt_increase' THEN amount 
           WHEN payment_type = 'debt_payment' THEN -amount 
           ELSE 0 END
    ), 0) INTO cust_debt
    FROM debt_payments 
    WHERE tenant_id = tid_text AND entity_type = 'customer' AND created_at::DATE <= d;
    IF cust_debt < 0 THEN cust_debt := 0; END IF;

    -- === SUPPLIER DEBT ===
    SELECT COALESCE(SUM(
      CASE WHEN payment_type = 'debt_increase' THEN amount 
           WHEN payment_type = 'debt_payment' THEN -amount 
           ELSE 0 END
    ), 0) INTO supp_debt
    FROM debt_payments 
    WHERE tenant_id = tid_text AND entity_type = 'supplier' AND created_at::DATE <= d;
    IF supp_debt < 0 THEN supp_debt := 0; END IF;

    -- Insert total snapshot
    INSERT INTO warehouse_value_snapshots (
      tenant_id, branch_id, snapshot_date, 
      inventory_value, cash_balance, customer_debt, supplier_debt, total_value
    ) VALUES (
      tid_text, NULL, d,
      inv_val, cash_val, cust_debt, supp_debt,
      inv_val + cash_val + cust_debt - supp_debt
    );
    
    inserted := inserted + 1;
  END LOOP;

  RETURN inserted;
END;
$$;