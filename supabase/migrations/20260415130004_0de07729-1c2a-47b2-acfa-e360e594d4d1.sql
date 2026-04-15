CREATE OR REPLACE FUNCTION public.get_report_stats_aggregated(
  p_tenant_id uuid,
  p_start_iso text,
  p_end_iso text,
  p_branch_id uuid DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_is_repair text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result jsonb;
  _total_sales_revenue numeric := 0;
  _business_profit numeric := 0;
  _return_profit_loss numeric := 0;
  _sales_count integer := 0;
  _products_sold numeric := 0;
  _total_return_revenue numeric := 0;
  _return_count integer := 0;
  _products_returned numeric := 0;
  _total_expenses numeric := 0;
  _other_income numeric := 0;
  _pay_cash numeric := 0;
  _pay_bank numeric := 0;
  _pay_ewallet numeric := 0;
  _pay_debt numeric := 0;
  _expenses_by_cat jsonb := '{}'::jsonb;
  _profit_by_cat jsonb := '[]'::jsonb;
  _repair_filter boolean := NULL;
  _start_ts timestamptz;
  _end_ts timestamptz;
BEGIN
  _start_ts := p_start_iso::timestamptz;
  _end_ts := p_end_iso::timestamptz;

  IF p_is_repair = 'repair' THEN
    _repair_filter := true;
  ELSIF p_is_repair = 'normal' THEN
    _repair_filter := false;
  END IF;

  -- Sales revenue
  IF p_category_id IS NULL THEN
    SELECT
      COALESCE(SUM(er.total_amount), 0),
      COUNT(*)
    INTO _total_sales_revenue, _sales_count
    FROM public.export_receipts er
    WHERE er.tenant_id = p_tenant_id
      AND er.status != 'cancelled'
      AND er.export_date >= _start_ts
      AND er.export_date <= _end_ts
      AND (p_branch_id IS NULL OR er.branch_id = p_branch_id)
      AND (_repair_filter IS NULL OR COALESCE(er.is_repair, false) = _repair_filter);
  ELSE
    SELECT
      COALESCE(SUM(eri.sale_price * COALESCE(NULLIF(eri.quantity, 0), 1)), 0),
      COUNT(DISTINCT er.id)
    INTO _total_sales_revenue, _sales_count
    FROM public.export_receipt_items eri
    JOIN public.export_receipts er ON er.id = eri.receipt_id
    WHERE er.tenant_id = p_tenant_id
      AND er.status != 'cancelled'
      AND eri.status = 'sold'
      AND er.export_date >= _start_ts
      AND er.export_date <= _end_ts
      AND (p_branch_id IS NULL OR er.branch_id = p_branch_id)
      AND eri.category_id = p_category_id
      AND (_repair_filter IS NULL OR COALESCE(er.is_repair, false) = _repair_filter);
  END IF;

  -- Business profit & products sold
  SELECT
    COALESCE(SUM((eri.sale_price - COALESCE(p.import_price, 0)) * COALESCE(NULLIF(eri.quantity, 0), 1)), 0),
    COALESCE(SUM(COALESCE(NULLIF(eri.quantity, 0), 1)), 0)
  INTO _business_profit, _products_sold
  FROM public.export_receipt_items eri
  JOIN public.export_receipts er ON er.id = eri.receipt_id
  LEFT JOIN public.products p ON p.id = eri.product_id
  WHERE er.tenant_id = p_tenant_id
    AND er.status != 'cancelled'
    AND eri.status = 'sold'
    AND er.export_date >= _start_ts
    AND er.export_date <= _end_ts
    AND (p_branch_id IS NULL OR er.branch_id = p_branch_id)
    AND (p_category_id IS NULL OR eri.category_id = p_category_id)
    AND (_repair_filter IS NULL OR COALESCE(er.is_repair, false) = _repair_filter);

  -- Returns: only count returns where fee_type is 'none' or NULL (no fixed fee)
  -- and no new import receipt was created
  SELECT
    COALESCE(SUM((
      CASE
        WHEN COALESCE(ret.refund_amount, 0) > 0 THEN COALESCE(ret.refund_amount, 0)
        ELSE COALESCE(ret.sale_price, 0) * COALESCE(NULLIF(ret.quantity, 0), 1)
      END
    ) - (COALESCE(p.import_price, 0) * COALESCE(NULLIF(ret.quantity, 0), 1))), 0),
    COALESCE(SUM(
      CASE
        WHEN COALESCE(ret.refund_amount, 0) > 0 THEN COALESCE(ret.refund_amount, 0)
        ELSE COALESCE(ret.sale_price, 0) * COALESCE(NULLIF(ret.quantity, 0), 1)
      END
    ), 0),
    COUNT(*),
    COALESCE(SUM(COALESCE(NULLIF(ret.quantity, 0), 1)), 0)
  INTO _return_profit_loss, _total_return_revenue, _return_count, _products_returned
  FROM public.export_returns ret
  LEFT JOIN public.products p ON p.id = ret.product_id
  LEFT JOIN public.export_receipts er ON er.id = ret.export_receipt_id
  WHERE ret.tenant_id = p_tenant_id
    AND ret.return_date >= _start_ts
    AND ret.return_date <= _end_ts
    AND (p_branch_id IS NULL OR ret.branch_id = p_branch_id)
    AND (p_category_id IS NULL OR p.category_id = p_category_id)
    AND (_repair_filter IS NULL OR COALESCE(er.is_repair, false) = _repair_filter)
    AND ret.new_import_receipt_id IS NULL
    AND (ret.fee_type IS NULL OR ret.fee_type = 'none')
    AND (COALESCE(ret.sale_price, 0) * COALESCE(NULLIF(ret.quantity, 0), 1)) > 0
    AND (
      COALESCE(ret.refund_amount, 0) <= 0
      OR ABS(
        COALESCE(ret.refund_amount, 0) -
        (COALESCE(ret.sale_price, 0) * COALESCE(NULLIF(ret.quantity, 0), 1))
      ) <= 1
    );

  _business_profit := _business_profit - _return_profit_loss;

  -- Payments
  IF p_category_id IS NULL THEN
    SELECT
      COALESCE(SUM(CASE WHEN erp.payment_type = 'cash' THEN erp.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN erp.payment_type = 'bank_card' THEN erp.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN erp.payment_type = 'e_wallet' THEN erp.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN erp.payment_type = 'debt' THEN erp.amount ELSE 0 END), 0)
    INTO _pay_cash, _pay_bank, _pay_ewallet, _pay_debt
    FROM public.export_receipt_payments erp
    JOIN public.export_receipts er ON er.id = erp.receipt_id
    WHERE er.tenant_id = p_tenant_id
      AND er.status != 'cancelled'
      AND er.export_date >= _start_ts
      AND er.export_date <= _end_ts
      AND (p_branch_id IS NULL OR er.branch_id = p_branch_id)
      AND (_repair_filter IS NULL OR COALESCE(er.is_repair, false) = _repair_filter);
  ELSE
    _pay_cash := 0;
    _pay_bank := 0;
    _pay_ewallet := 0;
    _pay_debt := 0;
  END IF;

  -- Expenses
  SELECT
    COALESCE(SUM(cb.amount), 0)
  INTO _total_expenses
  FROM public.cash_book cb
  WHERE cb.tenant_id = p_tenant_id
    AND cb.type = 'expense'
    AND cb.is_business_accounting = true
    AND cb.transaction_date >= (_start_ts AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text
    AND cb.transaction_date <= (_end_ts AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text
    AND (p_branch_id IS NULL OR cb.branch_id = p_branch_id);

  -- Other income
  SELECT
    COALESCE(SUM(cb.amount), 0)
  INTO _other_income
  FROM public.cash_book cb
  WHERE cb.tenant_id = p_tenant_id
    AND cb.type = 'income'
    AND cb.is_business_accounting = true
    AND cb.reference_type IS NULL
    AND cb.transaction_date >= (_start_ts AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text
    AND cb.transaction_date <= (_end_ts AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text
    AND (p_branch_id IS NULL OR cb.branch_id = p_branch_id);

  -- Expenses by category
  SELECT COALESCE(jsonb_object_agg(cat, total), '{}'::jsonb)
  INTO _expenses_by_cat
  FROM (
    SELECT cb.category as cat, SUM(cb.amount) as total
    FROM public.cash_book cb
    WHERE cb.tenant_id = p_tenant_id
      AND cb.type = 'expense'
      AND cb.is_business_accounting = true
      AND cb.transaction_date >= (_start_ts AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text
      AND cb.transaction_date <= (_end_ts AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text
      AND (p_branch_id IS NULL OR cb.branch_id = p_branch_id)
    GROUP BY cb.category
  ) sub;

  -- Profit by category
  SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]'::jsonb)
  INTO _profit_by_cat
  FROM (
    SELECT
      c.id as "categoryId",
      c.name as "categoryName",
      COALESCE(SUM(eri.sale_price * COALESCE(NULLIF(eri.quantity, 0), 1)), 0) as revenue,
      COALESCE(SUM((eri.sale_price - COALESCE(p.import_price, 0)) * COALESCE(NULLIF(eri.quantity, 0), 1)), 0) as profit,
      COUNT(DISTINCT er.id) as count
    FROM public.export_receipt_items eri
    JOIN public.export_receipts er ON er.id = eri.receipt_id
    LEFT JOIN public.products p ON p.id = eri.product_id
    LEFT JOIN public.categories c ON c.id = eri.category_id
    WHERE er.tenant_id = p_tenant_id
      AND er.status != 'cancelled'
      AND eri.status = 'sold'
      AND er.export_date >= _start_ts
      AND er.export_date <= _end_ts
      AND (p_branch_id IS NULL OR er.branch_id = p_branch_id)
      AND (_repair_filter IS NULL OR COALESCE(er.is_repair, false) = _repair_filter)
    GROUP BY c.id, c.name
    ORDER BY revenue DESC
  ) sub;

  -- Build result
  result := jsonb_build_object(
    'totalSalesRevenue', _total_sales_revenue,
    'totalReturnRevenue', _total_return_revenue,
    'netRevenue', _total_sales_revenue - _total_return_revenue,
    'businessProfit', _business_profit,
    'totalExpenses', _total_expenses,
    'otherIncome', _other_income,
    'netProfit', _business_profit - _total_expenses + _other_income,
    'salesCount', _sales_count,
    'returnCount', _return_count,
    'productsSold', _products_sold,
    'productsReturned', _products_returned,
    'paymentsBySource', jsonb_build_object(
      'cash', _pay_cash,
      'bank_card', _pay_bank,
      'e_wallet', _pay_ewallet,
      'debt', _pay_debt
    ),
    'expensesByCategory', _expenses_by_cat,
    'profitByCategory', _profit_by_cat
  );

  RETURN result;
END;
$function$;