
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
AS $$
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

  /*
    FORMULA (Updated):
    totalSalesRevenue = SUM(sale_price * quantity) of export_receipt_items where status = 'sold'
    totalReturnRevenue = SUM(refund_amount) of ALL export_returns (no fee_type filter)
    netRevenue = totalSalesRevenue - totalReturnRevenue
    businessProfit = sales profit - return profit loss
    netProfit = businessProfit + otherIncome - totalExpenses
  */

  -- 1. Sales revenue & profit
  SELECT
    COALESCE(SUM(eri.sale_price * COALESCE(NULLIF(eri.quantity, 0), 1)), 0),
    COUNT(DISTINCT er.id),
    COALESCE(SUM((eri.sale_price - COALESCE(p.import_price, 0)) * COALESCE(NULLIF(eri.quantity, 0), 1)), 0),
    COALESCE(SUM(COALESCE(NULLIF(eri.quantity, 0), 1)), 0)
  INTO _total_sales_revenue, _sales_count, _business_profit, _products_sold
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

  -- 2. Return revenue: use refund_amount, NO fee_type filter
  SELECT
    COALESCE(SUM((ret.sale_price - COALESCE(p.import_price, 0)) * COALESCE(NULLIF(ret.quantity, 0), 1)), 0),
    COALESCE(SUM(ret.refund_amount), 0),
    COUNT(*),
    COALESCE(SUM(COALESCE(NULLIF(ret.quantity, 0), 1)), 0)
  INTO _return_profit_loss, _total_return_revenue, _return_count, _products_returned
  FROM public.export_returns ret
  LEFT JOIN public.products p ON p.id = ret.product_id
  WHERE ret.tenant_id = p_tenant_id
    AND ret.return_date >= _start_ts
    AND ret.return_date <= _end_ts
    AND (p_branch_id IS NULL OR ret.branch_id = p_branch_id)
    AND (p_category_id IS NULL OR p.category_id = p_category_id);

  _business_profit := _business_profit - _return_profit_loss;

  -- 3. Payment sources
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

  -- 4. Expenses & Income from cash_book
  SELECT
    COALESCE(SUM(CASE WHEN cb.type = 'expense' THEN cb.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cb.type = 'income' THEN cb.amount ELSE 0 END), 0)
  INTO _total_expenses, _other_income
  FROM public.cash_book cb
  WHERE cb.tenant_id = p_tenant_id
    AND cb.is_business_accounting = true
    AND cb.transaction_date >= _start_ts
    AND cb.transaction_date <= _end_ts
    AND (p_branch_id IS NULL OR cb.branch_id = p_branch_id);

  -- 5. Expenses by category
  SELECT COALESCE(jsonb_object_agg(cat, total), '{}'::jsonb)
  INTO _expenses_by_cat
  FROM (
    SELECT cb.category AS cat, SUM(cb.amount)::numeric AS total
    FROM public.cash_book cb
    WHERE cb.tenant_id = p_tenant_id
      AND cb.type = 'expense'
      AND cb.is_business_accounting = true
      AND cb.transaction_date >= _start_ts
      AND cb.transaction_date <= _end_ts
      AND (p_branch_id IS NULL OR cb.branch_id = p_branch_id)
    GROUP BY cb.category
  ) sub;

  -- 6. Profit by category
  SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
  INTO _profit_by_cat
  FROM (
    SELECT
      eri.category_id AS "categoryId",
      COALESCE(c.name, 'Chưa phân loại') AS "categoryName",
      COUNT(DISTINCT er.id) AS "count",
      COALESCE(SUM(eri.sale_price * COALESCE(NULLIF(eri.quantity, 0), 1)), 0)::numeric AS "revenue",
      COALESCE(SUM((eri.sale_price - COALESCE(p.import_price, 0)) * COALESCE(NULLIF(eri.quantity, 0), 1)), 0)::numeric AS "profit"
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
    GROUP BY eri.category_id, c.name
    ORDER BY "revenue" DESC
  ) sub;

  result := jsonb_build_object(
    'totalSalesRevenue', _total_sales_revenue,
    'totalReturnRevenue', _total_return_revenue,
    'netRevenue', _total_sales_revenue - _total_return_revenue,
    'businessProfit', _business_profit,
    'totalExpenses', _total_expenses,
    'otherIncome', _other_income,
    'netProfit', _business_profit + _other_income - _total_expenses,
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
$$;
