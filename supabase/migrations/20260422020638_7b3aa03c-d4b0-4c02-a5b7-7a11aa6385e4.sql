
CREATE OR REPLACE FUNCTION public.get_daily_change_breakdown(
  _tid uuid,
  _date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_import_cost numeric := 0;
  v_import_count int := 0;
  v_export_cost numeric := 0;
  v_export_count int := 0;
  v_cust_return_cost numeric := 0;
  v_cust_return_count int := 0;
  v_supp_return_cost numeric := 0;
  v_supp_return_count int := 0;
  v_cash_in numeric := 0;
  v_cash_out numeric := 0;
  v_prev_total numeric := 0;
  v_curr_total numeric := 0;
BEGIN
  v_day_start := _date::timestamptz;
  v_day_end := (_date + 1)::timestamptz;

  -- Imports on this day (cost = sum of import prices)
  SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(COALESCE(ir.total_amount, 0)), 0)
  INTO v_import_count, v_import_cost
  FROM public.import_receipts ir
  WHERE ir.tenant_id = _tid
    AND ir.status = 'completed'
    AND ir.import_date >= v_day_start AND ir.import_date < v_day_end;

  -- Exports/Sales on this day (cost = sum of cost price from items)
  SELECT COALESCE(COUNT(DISTINCT er.id), 0),
         COALESCE(SUM(COALESCE(ei.import_price, 0) * COALESCE(ei.quantity, 1)), 0)
  INTO v_export_count, v_export_cost
  FROM public.export_receipts er
  JOIN public.export_receipt_items ei ON ei.receipt_id = er.id
  WHERE er.tenant_id = _tid
    AND er.status IN ('completed', 'partial_return')
    AND er.export_date >= v_day_start AND er.export_date < v_day_end;

  -- Customer returns (items coming back into stock)
  SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(COALESCE(import_price, 0) * COALESCE(quantity, 1)), 0)
  INTO v_cust_return_count, v_cust_return_cost
  FROM public.export_returns
  WHERE tenant_id = _tid
    AND return_date >= v_day_start AND return_date < v_day_end;

  -- Supplier returns (items leaving stock)
  SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(COALESCE(import_price, 0) * COALESCE(quantity, 1)), 0)
  INTO v_supp_return_count, v_supp_return_cost
  FROM public.import_returns
  WHERE tenant_id = _tid
    AND return_date >= v_day_start AND return_date < v_day_end;

  -- Cash flow on this day
  SELECT
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
  INTO v_cash_in, v_cash_out
  FROM public.cash_book
  WHERE tenant_id = _tid
    AND transaction_date::date = _date;

  -- Snapshot values
  SELECT COALESCE(total_value, 0) INTO v_curr_total
  FROM public.warehouse_value_snapshots
  WHERE tenant_id = _tid AND branch_id IS NULL AND snapshot_date = _date;

  SELECT COALESCE(total_value, 0) INTO v_prev_total
  FROM public.warehouse_value_snapshots
  WHERE tenant_id = _tid AND branch_id IS NULL AND snapshot_date = _date - 1;

  result := jsonb_build_object(
    'date', _date,
    'imports', jsonb_build_object('count', v_import_count, 'cost', v_import_cost),
    'exports', jsonb_build_object('count', v_export_count, 'cost', v_export_cost),
    'customer_returns', jsonb_build_object('count', v_cust_return_count, 'cost', v_cust_return_cost),
    'supplier_returns', jsonb_build_object('count', v_supp_return_count, 'cost', v_supp_return_cost),
    'cash_in', v_cash_in,
    'cash_out', v_cash_out,
    'prev_total', v_prev_total,
    'curr_total', v_curr_total,
    'total_change', v_curr_total - v_prev_total
  );

  RETURN result;
END;
$$;
