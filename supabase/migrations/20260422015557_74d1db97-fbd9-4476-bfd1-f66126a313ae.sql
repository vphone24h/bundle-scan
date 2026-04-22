DROP FUNCTION IF EXISTS public.backfill_warehouse_snapshots_v2(text);
DROP FUNCTION IF EXISTS public.backfill_warehouse_snapshots_v2(uuid);

DROP POLICY IF EXISTS "Tenant users can view warehouse snapshots" ON public.warehouse_value_snapshots;
DROP POLICY IF EXISTS "Tenant users can insert warehouse snapshots" ON public.warehouse_value_snapshots;

ALTER TABLE public.warehouse_value_snapshots
ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;

ALTER TABLE public.warehouse_value_snapshots
DROP CONSTRAINT IF EXISTS warehouse_value_snapshots_tenant_id_branch_id_snapshot_date_key;

DROP INDEX IF EXISTS public.idx_warehouse_snapshot_all;
DROP INDEX IF EXISTS public.warehouse_value_snapshots_tenant_id_branch_id_snapshot_date_key;

ALTER TABLE public.warehouse_value_snapshots
ADD CONSTRAINT warehouse_value_snapshots_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS warehouse_value_snapshots_total_unique_idx
ON public.warehouse_value_snapshots (tenant_id, snapshot_date)
WHERE branch_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS warehouse_value_snapshots_branch_unique_idx
ON public.warehouse_value_snapshots (tenant_id, branch_id, snapshot_date)
WHERE branch_id IS NOT NULL;

CREATE POLICY "Tenant users can view warehouse snapshots"
ON public.warehouse_value_snapshots
FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id_secure());

CREATE POLICY "Tenant users can insert warehouse snapshots"
ON public.warehouse_value_snapshots
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id_secure());

CREATE OR REPLACE FUNCTION public.backfill_warehouse_snapshots_v2(_tid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '120s'
SET search_path = public
AS $$
DECLARE
  d date;
  v_day_end timestamptz;
  inv_val numeric := 0;
  cash_val numeric := 0;
  cust_debt numeric := 0;
  supp_debt numeric := 0;
  processed int := 0;
  start_date date;
BEGIN
  start_date := CURRENT_DATE - 60;

  DELETE FROM public.warehouse_value_snapshots
  WHERE tenant_id = _tid
    AND branch_id IS NULL
    AND snapshot_date >= start_date
    AND snapshot_date < CURRENT_DATE;

  FOR d IN
    SELECT generate_series(start_date, CURRENT_DATE - 1, '1 day'::interval)::date
  LOOP
    v_day_end := (d + INTERVAL '1 day');

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
      AND cb.transaction_date::date <= d;

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
      tenant_id,
      branch_id,
      snapshot_date,
      inventory_value,
      cash_balance,
      customer_debt,
      supplier_debt,
      total_value
    ) VALUES (
      _tid,
      NULL,
      d,
      inv_val,
      cash_val,
      cust_debt,
      supp_debt,
      inv_val + cash_val + cust_debt - supp_debt
    )
    ON CONFLICT (tenant_id, snapshot_date) WHERE branch_id IS NULL
    DO UPDATE SET
      inventory_value = EXCLUDED.inventory_value,
      cash_balance = EXCLUDED.cash_balance,
      customer_debt = EXCLUDED.customer_debt,
      supplier_debt = EXCLUDED.supplier_debt,
      total_value = EXCLUDED.total_value;

    processed := processed + 1;
  END LOOP;

  RETURN processed;
END;
$$;