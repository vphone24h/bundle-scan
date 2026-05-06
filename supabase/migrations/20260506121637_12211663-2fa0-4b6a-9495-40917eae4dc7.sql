CREATE OR REPLACE FUNCTION public.snapshot_warehouse_values_for_tenant(_tid uuid, _date date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '120s'
SET search_path TO 'public'
AS $function$
DECLARE
  v_day_end timestamptz;
  inv_val numeric := 0;
  cash_val numeric := 0;
  cust_debt numeric := 0;
  supp_debt numeric := 0;
  br RECORD;
  b_inv numeric;
  b_cash numeric;
  b_cust numeric;
  b_supp numeric;
BEGIN
  v_day_end := (_date + INTERVAL '1 day');

  SELECT COALESCE(SUM(COALESCE(p.import_price, 0)), 0)
  INTO inv_val
  FROM public.products p
  WHERE p.tenant_id = _tid
    AND p.status <> 'deleted'
    AND COALESCE(p.imei, '') <> ''
    AND p.import_date IS NOT NULL
    AND p.import_date < v_day_end
    AND (
      p.status = 'in_stock'
      OR (p.status = 'sold' AND p.updated_at >= v_day_end)
      OR (p.status = 'returned' AND p.updated_at >= v_day_end)
    );

  inv_val := inv_val + COALESCE((
    SELECT SUM(COALESCE(p.total_import_cost, 0))
    FROM public.products p
    WHERE p.tenant_id = _tid
      AND COALESCE(p.imei, '') = ''
      AND p.status <> 'deleted'
      AND p.import_date IS NOT NULL
      AND p.import_date < v_day_end
  ), 0);

  SELECT COALESCE(SUM(CASE WHEN cb.type = 'income' THEN cb.amount ELSE -cb.amount END), 0)
  INTO cash_val
  FROM public.cash_book cb
  WHERE cb.tenant_id = _tid
    AND cb.transaction_date::date <= _date;

  SELECT COALESCE(SUM(GREATEST(COALESCE(er.debt_amount, 0) - COALESCE(paid.total_paid, 0), 0)), 0)
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

  SELECT COALESCE(SUM(GREATEST(COALESCE(ir.debt_amount, 0) - COALESCE(paid.total_paid, 0), 0)), 0)
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

  INSERT INTO public.warehouse_value_snapshots (
    tenant_id, branch_id, snapshot_date,
    inventory_value, cash_balance, customer_debt, supplier_debt, total_value
  ) VALUES (
    _tid, NULL, _date,
    inv_val, cash_val, cust_debt, supp_debt,
    inv_val + cash_val + cust_debt - supp_debt
  )
  ON CONFLICT (tenant_id, snapshot_date) WHERE branch_id IS NULL
  DO UPDATE SET
    inventory_value = EXCLUDED.inventory_value,
    cash_balance = EXCLUDED.cash_balance,
    customer_debt = EXCLUDED.customer_debt,
    supplier_debt = EXCLUDED.supplier_debt,
    total_value = EXCLUDED.total_value;

  FOR br IN SELECT id FROM public.branches WHERE tenant_id = _tid LOOP
    SELECT COALESCE(SUM(COALESCE(p.import_price, 0)), 0)
    INTO b_inv
    FROM public.products p
    WHERE p.tenant_id = _tid
      AND p.branch_id = br.id
      AND p.status <> 'deleted'
      AND COALESCE(p.imei, '') <> ''
      AND p.import_date IS NOT NULL
      AND p.import_date < v_day_end
      AND (
        p.status = 'in_stock'
        OR (p.status = 'sold' AND p.updated_at >= v_day_end)
        OR (p.status = 'returned' AND p.updated_at >= v_day_end)
      );

    b_inv := b_inv + COALESCE((
      SELECT SUM(COALESCE(p.total_import_cost, 0))
      FROM public.products p
      WHERE p.tenant_id = _tid
        AND p.branch_id = br.id
        AND COALESCE(p.imei, '') = ''
        AND p.status <> 'deleted'
        AND p.import_date IS NOT NULL
        AND p.import_date < v_day_end
    ), 0);

    SELECT COALESCE(SUM(CASE WHEN cb.type = 'income' THEN cb.amount ELSE -cb.amount END), 0)
    INTO b_cash
    FROM public.cash_book cb
    WHERE cb.tenant_id = _tid
      AND cb.branch_id = br.id
      AND cb.transaction_date::date <= _date;

    SELECT COALESCE(SUM(GREATEST(COALESCE(er.debt_amount, 0) - COALESCE(paid.total_paid, 0), 0)), 0)
    INTO b_cust
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
      AND er.branch_id = br.id
      AND er.status IN ('completed', 'partial_return')
      AND COALESCE(er.debt_amount, 0) > 0
      AND er.export_date < v_day_end;

    SELECT COALESCE(SUM(GREATEST(COALESCE(ir.debt_amount, 0) - COALESCE(paid.total_paid, 0), 0)), 0)
    INTO b_supp
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
      AND ir.branch_id = br.id
      AND ir.status = 'completed'
      AND COALESCE(ir.debt_amount, 0) > 0
      AND ir.import_date < v_day_end;

    INSERT INTO public.warehouse_value_snapshots (
      tenant_id, branch_id, snapshot_date,
      inventory_value, cash_balance, customer_debt, supplier_debt, total_value
    ) VALUES (
      _tid, br.id, _date,
      b_inv, b_cash, b_cust, b_supp,
      b_inv + b_cash + b_cust - b_supp
    )
    ON CONFLICT (tenant_id, branch_id, snapshot_date) WHERE branch_id IS NOT NULL
    DO UPDATE SET
      inventory_value = EXCLUDED.inventory_value,
      cash_balance = EXCLUDED.cash_balance,
      customer_debt = EXCLUDED.customer_debt,
      supplier_debt = EXCLUDED.supplier_debt,
      total_value = EXCLUDED.total_value;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.snapshot_warehouse_values_all_tenants()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '600s'
SET search_path TO 'public'
AS $function$
DECLARE
  t RECORD;
  cnt int := 0;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    BEGIN
      PERFORM public.snapshot_warehouse_values_for_tenant(t.id, CURRENT_DATE);
      cnt := cnt + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'snapshot failed for tenant %: %', t.id, SQLERRM;
    END;
  END LOOP;
  RETURN cnt;
END;
$function$;

DO $$
BEGIN
  PERFORM cron.unschedule('daily-warehouse-snapshot');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'daily-warehouse-snapshot',
  '59 16 * * *',
  $$ SELECT public.snapshot_warehouse_values_all_tenants(); $$
);