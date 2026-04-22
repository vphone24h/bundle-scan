
CREATE OR REPLACE FUNCTION public.backfill_warehouse_snapshots_v2(_tid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '120s'
AS $$
DECLARE
  d DATE;
  v_day_end TIMESTAMPTZ;
  inv_val NUMERIC := 0;
  cash_val NUMERIC := 0;
  cust_debt NUMERIC := 0;
  supp_debt NUMERIC := 0;
  processed INT := 0;
  start_date DATE;
BEGIN
  -- Max 60 days back
  start_date := CURRENT_DATE - 60;

  -- Delete old snapshots for this tenant in range (clean slate)
  DELETE FROM public.warehouse_value_snapshots
  WHERE tenant_id = _tid
    AND snapshot_date >= start_date
    AND snapshot_date < CURRENT_DATE;

  FOR d IN SELECT generate_series(start_date, CURRENT_DATE - 1, '1 day'::INTERVAL)::DATE
  LOOP
    v_day_end := (d + INTERVAL '1 day');

    -- ========== INVENTORY VALUE ==========
    -- IMEI products: use import_price for items that were in stock on that day
    -- A product was in stock if: imported before day_end AND (still in_stock today OR was sold/returned after day_end)
    SELECT COALESCE(SUM(
      CASE
        WHEN COALESCE(p.imei, '') <> '' THEN COALESCE(p.import_price, 0)
        ELSE 0
      END
    ), 0)
    INTO inv_val
    FROM public.products p
    WHERE p.tenant_id = _tid
      AND p.status <> 'deleted'
      AND COALESCE(p.imei, '') <> ''
      AND p.import_date IS NOT NULL
      AND p.import_date < v_day_end
      AND (
        -- Still in stock today (was definitely in stock on that day or earlier)
        (p.status = 'in_stock')
        OR
        -- Was sold/exported AFTER this day, so was in stock on this day
        (p.status = 'sold' AND p.updated_at >= v_day_end)
        OR
        -- Was returned to supplier AFTER this day
        (p.status = 'returned' AND p.updated_at >= v_day_end)
      );

    -- Non-IMEI products: use product_imports cost, approximated by current totalImportCost
    -- (reconstructing FIFO historically is too complex and error-prone)
    inv_val := inv_val + COALESCE((
      SELECT SUM(COALESCE(p.total_import_cost, 0))
      FROM public.products p
      WHERE p.tenant_id = _tid
        AND COALESCE(p.imei, '') = ''
        AND p.status <> 'deleted'
        AND p.import_date IS NOT NULL
        AND p.import_date < v_day_end
    ), 0);

    -- ========== CASH BALANCE ==========
    SELECT COALESCE(SUM(
      CASE WHEN type = 'income' THEN amount ELSE -amount END
    ), 0)
    INTO cash_val
    FROM public.cash_book
    WHERE tenant_id = _tid
      AND transaction_date::DATE <= d;

    -- ========== CUSTOMER DEBT ==========
    -- Outstanding debt from export_receipts minus payments
    SELECT COALESCE(SUM(GREATEST(
      COALESCE(er.debt_amount, 0) - COALESCE(paid.total_paid, 0),
      0
    )), 0)
    INTO cust_debt
    FROM public.export_receipts er
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(dp.amount), 0) AS total_paid
      FROM public.debt_payments dp
      WHERE dp.entity_id = er.customer_id
        AND dp.entity_type = 'customer'
        AND dp.payment_type IN ('payment', 'addition')
        AND dp.created_at < v_day_end
    ) paid ON TRUE
    WHERE er.tenant_id = _tid
      AND er.status IN ('completed', 'partial_return')
      AND COALESCE(er.debt_amount, 0) > 0
      AND er.export_date < v_day_end;

    -- ========== SUPPLIER DEBT ==========
    SELECT COALESCE(SUM(GREATEST(
      COALESCE(ir.debt_amount, 0) - COALESCE(paid.total_paid, 0),
      0
    )), 0)
    INTO supp_debt
    FROM public.import_receipts ir
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(dp.amount), 0) AS total_paid
      FROM public.debt_payments dp
      WHERE dp.entity_id = ir.supplier_id
        AND dp.entity_type = 'supplier'
        AND dp.payment_type IN ('payment', 'addition')
        AND dp.created_at < v_day_end
    ) paid ON TRUE
    WHERE ir.tenant_id = _tid
      AND ir.status = 'completed'
      AND COALESCE(ir.debt_amount, 0) > 0
      AND ir.import_date < v_day_end;

    -- ========== INSERT SNAPSHOT ==========
    INSERT INTO public.warehouse_value_snapshots (
      tenant_id, branch_id, snapshot_date,
      inventory_value, cash_balance, customer_debt, supplier_debt, total_value
    ) VALUES (
      _tid, NULL, d,
      inv_val, cash_val, cust_debt, supp_debt,
      inv_val + cash_val + cust_debt - supp_debt
    );

    processed := processed + 1;
  END LOOP;

  RETURN processed;
END;
$$;
