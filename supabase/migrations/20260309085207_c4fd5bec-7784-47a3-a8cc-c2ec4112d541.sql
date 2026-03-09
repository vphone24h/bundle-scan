
CREATE OR REPLACE FUNCTION public.get_report_stats_aggregated(p_tenant_id uuid, p_start_iso timestamp with time zone, p_end_iso timestamp with time zone, p_branch_id uuid DEFAULT NULL::uuid, p_category_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  _total_sales_revenue numeric := 0;
  _business_profit numeric := 0;
  _return_profit_loss numeric := 0;
  _sales_count integer := 0;
  _products_sold integer := 0;
  _total_return_revenue numeric := 0;
  _products_returned integer := 0;
  _total_expenses numeric := 0;
  _other_income numeric := 0;
  _pay_cash numeric := 0;
  _pay_bank numeric := 0;
  _pay_ewallet numeric := 0;
  _pay_debt numeric := 0;
  _expenses_by_cat jsonb := '{}'::jsonb;
  _profit_by_cat jsonb := '[]'::jsonb;
BEGIN
  -- 1a. Tong doanh thu ban hang
  IF p_category_id IS NULL THEN
    SELECT 
      COALESCE(SUM(er.total_amount), 0),
      COUNT(DISTINCT er.id)
    INTO _total_sales_revenue, _sales_count
    FROM export_receipts er
    WHERE er.tenant_id = p_tenant_id
      AND er.status != 'cancelled'
      AND er.export_date >= p_start_iso
      AND er.export_date <= p_end_iso
      AND (p_branch_id IS NULL OR er.branch_id = p_branch_id);
  ELSE
    SELECT 
      COALESCE(SUM(eri.sale_price), 0),
      COUNT(DISTINCT er.id)
    INTO _total_sales_revenue, _sales_count
    FROM export_receipt_items eri
    JOIN export_receipts er ON er.id = eri.receipt_id
    WHERE er.tenant_id = p_tenant_id
      AND er.status != 'cancelled'
      AND eri.status IN ('sold', 'returned')
      AND eri.category_id = p_category_id
      AND er.export_date >= p_start_iso
      AND er.export_date <= p_end_iso
      AND (p_branch_id IS NULL OR er.branch_id = p_branch_id);
  END IF;

  -- 1b. Loi nhuan kinh doanh = tong loi nhuan tung don (chi sold)
  SELECT 
    COALESCE(SUM(eri.sale_price - COALESCE(p.import_price, 0)), 0),
    COUNT(*)
  INTO _business_profit, _products_sold
  FROM export_receipt_items eri
  JOIN export_receipts er ON er.id = eri.receipt_id
  LEFT JOIN products p ON p.id = eri.product_id
  WHERE er.tenant_id = p_tenant_id
    AND er.status != 'cancelled'
    AND eri.status = 'sold'
    AND er.export_date >= p_start_iso
    AND er.export_date <= p_end_iso
    AND (p_branch_id IS NULL OR er.branch_id = p_branch_id)
    AND (p_category_id IS NULL OR eri.category_id = p_category_id);

  -- 1c. Tru loi nhuan mat tu tra hang
  IF p_category_id IS NULL THEN
    SELECT COALESCE(SUM(ret.sale_price - COALESCE(p.import_price, 0)), 0)
    INTO _return_profit_loss
    FROM export_returns ret
    LEFT JOIN products p ON p.id = ret.product_id
    WHERE ret.tenant_id = p_tenant_id
      AND ret.fee_type = 'none'
      AND ret.return_date >= p_start_iso
      AND ret.return_date <= p_end_iso
      AND (p_branch_id IS NULL OR ret.branch_id = p_branch_id);
  ELSE
    SELECT COALESCE(SUM(ret.sale_price - COALESCE(p.import_price, 0)), 0)
    INTO _return_profit_loss
    FROM export_returns ret
    LEFT JOIN products p ON p.id = ret.product_id
    WHERE ret.tenant_id = p_tenant_id
      AND ret.fee_type = 'none'
      AND ret.return_date >= p_start_iso
      AND ret.return_date <= p_end_iso
      AND (p_branch_id IS NULL OR ret.branch_id = p_branch_id)
      AND p.category_id = p_category_id;
  END IF;

  _business_profit := _business_profit - _return_profit_loss;

  -- 2. Doanh thu tra hang
  IF p_category_id IS NULL THEN
    SELECT 
      COALESCE(SUM(ret.sale_price), 0),
      COUNT(*)
    INTO _total_return_revenue, _products_returned
    FROM export_returns ret
    WHERE ret.tenant_id = p_tenant_id
      AND ret.fee_type = 'none'
      AND ret.return_date >= p_start_iso
      AND ret.return_date <= p_end_iso
      AND (p_branch_id IS NULL OR ret.branch_id = p_branch_id);
  ELSE
    SELECT 
      COALESCE(SUM(ret.sale_price), 0),
      COUNT(*)
    INTO _total_return_revenue, _products_returned
    FROM export_returns ret
    LEFT JOIN products p ON p.id = ret.product_id
    WHERE ret.tenant_id = p_tenant_id
      AND ret.fee_type = 'none'
      AND ret.return_date >= p_start_iso
      AND ret.return_date <= p_end_iso
      AND (p_branch_id IS NULL OR ret.branch_id = p_branch_id)
      AND p.category_id = p_category_id;
  END IF;

  -- 3. Payment sources
  IF p_category_id IS NULL THEN
    SELECT 
      COALESCE(SUM(CASE WHEN erp.payment_type = 'cash' THEN erp.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN erp.payment_type = 'bank_card' THEN erp.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN erp.payment_type = 'e_wallet' THEN erp.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN erp.payment_type = 'debt' THEN erp.amount ELSE 0 END), 0)
    INTO _pay_cash, _pay_bank, _pay_ewallet, _pay_debt
    FROM export_receipt_payments erp
    JOIN export_receipts er ON er.id = erp.receipt_id
    WHERE er.tenant_id = p_tenant_id
      AND er.status != 'cancelled'
      AND er.export_date >= p_start_iso
      AND er.export_date <= p_end_iso
      AND (p_branch_id IS NULL OR er.branch_id = p_branch_id);
  ELSE
    _pay_cash := 0;
    _pay_bank := 0;
    _pay_ewallet := 0;
    _pay_debt := 0;
  END IF;

  -- 4. So quy
  SELECT 
    COALESCE(SUM(CASE WHEN cb.type = 'expense' THEN cb.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cb.type = 'income' THEN cb.amount ELSE 0 END), 0)
  INTO _total_expenses, _other_income
  FROM cash_book cb
  WHERE cb.tenant_id = p_tenant_id
    AND cb.is_business_accounting = true
    AND cb.transaction_date >= p_start_iso
    AND cb.transaction_date <= p_end_iso
    AND (p_branch_id IS NULL OR cb.branch_id = p_branch_id);

  -- 5. Chi phi theo danh muc
  SELECT COALESCE(jsonb_object_agg(cat, total), '{}'::jsonb)
  INTO _expenses_by_cat
  FROM (
    SELECT cb.category AS cat, SUM(cb.amount)::numeric AS total
    FROM cash_book cb
    WHERE cb.tenant_id = p_tenant_id
      AND cb.is_business_accounting = true
      AND cb.type = 'expense'
      AND cb.transaction_date >= p_start_iso
      AND cb.transaction_date <= p_end_iso
      AND (p_branch_id IS NULL OR cb.branch_id = p_branch_id)
    GROUP BY cb.category
  ) sub;

  -- 6. Loi nhuan theo danh muc - chi sold
  SELECT COALESCE(jsonb_agg(row_to_json(sub) ORDER BY sub.profit DESC), '[]'::jsonb)
  INTO _profit_by_cat
  FROM (
    SELECT 
      COALESCE(eri.category_id::text, 'uncategorized') AS "categoryId",
      COALESCE(cat.name, 'Chua phan loai') AS "categoryName",
      SUM(eri.sale_price)::numeric AS revenue,
      SUM(eri.sale_price - COALESCE(p.import_price, 0))::numeric AS profit,
      COUNT(*)::integer AS count
    FROM export_receipt_items eri
    JOIN export_receipts er ON er.id = eri.receipt_id
    LEFT JOIN products p ON p.id = eri.product_id
    LEFT JOIN categories cat ON cat.id = eri.category_id
    WHERE er.tenant_id = p_tenant_id
      AND er.status != 'cancelled'
      AND eri.status = 'sold'
      AND er.export_date >= p_start_iso
      AND er.export_date <= p_end_iso
      AND (p_branch_id IS NULL OR er.branch_id = p_branch_id)
      AND (p_category_id IS NULL OR eri.category_id = p_category_id)
    GROUP BY eri.category_id, cat.name
  ) sub;

  result := jsonb_build_object(
    'totalSalesRevenue', _total_sales_revenue,
    'totalReturnRevenue', _total_return_revenue,
    'netRevenue', _total_sales_revenue - _total_return_revenue,
    'businessProfit', _business_profit,
    'totalExpenses', _total_expenses,
    'otherIncome', _other_income,
    'netProfit', (_business_profit + _other_income) - _total_expenses,
    'salesCount', _sales_count,
    'returnCount', _products_returned,
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
