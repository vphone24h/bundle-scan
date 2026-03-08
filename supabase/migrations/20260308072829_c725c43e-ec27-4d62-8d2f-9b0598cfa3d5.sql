-- Composite indexes for high-volume queries (1M+ orders)

-- Export receipts: tenant + date (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_export_receipts_tenant_date 
ON public.export_receipts (tenant_id, export_date DESC);

-- Import receipts: tenant + date
CREATE INDEX IF NOT EXISTS idx_import_receipts_date 
ON public.import_receipts (import_date DESC);

CREATE INDEX IF NOT EXISTS idx_import_receipts_tenant_date 
ON public.import_receipts (tenant_id, import_date DESC);

-- Export receipt items: status filter (sold/returned)
CREATE INDEX IF NOT EXISTS idx_export_receipt_items_status 
ON public.export_receipt_items (status);

-- Export returns: date + fee_type
CREATE INDEX IF NOT EXISTS idx_export_returns_date 
ON public.export_returns (return_date DESC);

CREATE INDEX IF NOT EXISTS idx_export_returns_tenant_date 
ON public.export_returns (tenant_id, return_date DESC);

CREATE INDEX IF NOT EXISTS idx_export_returns_fee_type 
ON public.export_returns (fee_type);

-- Cash book: business accounting + date composite
CREATE INDEX IF NOT EXISTS idx_cash_book_biz_date 
ON public.cash_book (tenant_id, is_business_accounting, transaction_date DESC) 
WHERE is_business_accounting = true;

-- Products: import_receipt_id for receipt detail lookups
CREATE INDEX IF NOT EXISTS idx_products_import_receipt 
ON public.products (import_receipt_id) WHERE import_receipt_id IS NOT NULL;

-- Import receipts: code search with trigram
CREATE INDEX IF NOT EXISTS idx_import_receipts_code_gin
ON public.import_receipts USING gin (code gin_trgm_ops);

-- ===================================
-- RPC: get_report_stats_aggregated
-- Server-side aggregation for report stats (replaces fetchAllRows)
-- ===================================
CREATE OR REPLACE FUNCTION public.get_report_stats_aggregated(
  p_tenant_id uuid,
  p_start_iso timestamptz,
  p_end_iso timestamptz,
  p_branch_id uuid DEFAULT NULL,
  p_category_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  _total_sales_revenue numeric := 0;
  _business_profit numeric := 0;
  _sales_count integer := 0;
  _products_sold integer := 0;
  _total_return_revenue numeric := 0;
  _return_profit numeric := 0;
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
  -- 1. Sales: revenue + profit from sold items
  SELECT 
    COALESCE(SUM(eri.sale_price), 0),
    COALESCE(SUM(eri.sale_price - COALESCE(p.import_price, 0)), 0),
    COUNT(*)
  INTO _total_sales_revenue, _business_profit, _products_sold
  FROM export_receipt_items eri
  JOIN export_receipts er ON er.id = eri.receipt_id
  LEFT JOIN products p ON p.id = eri.product_id
  WHERE er.tenant_id = p_tenant_id
    AND er.status != 'cancelled'
    AND eri.status IN ('sold', 'returned')
    AND er.export_date >= p_start_iso
    AND er.export_date <= p_end_iso
    AND (p_branch_id IS NULL OR er.branch_id = p_branch_id)
    AND (p_category_id IS NULL OR eri.category_id = p_category_id);

  -- Sales count (distinct receipts)
  SELECT COUNT(DISTINCT er.id)
  INTO _sales_count
  FROM export_receipts er
  WHERE er.tenant_id = p_tenant_id
    AND er.status != 'cancelled'
    AND er.export_date >= p_start_iso
    AND er.export_date <= p_end_iso
    AND (p_branch_id IS NULL OR er.branch_id = p_branch_id);

  -- 2. Returns (fee_type = 'none')
  SELECT 
    COALESCE(SUM(ret.sale_price), 0),
    COALESCE(SUM(ret.sale_price - COALESCE(ret.import_price, 0)), 0),
    COUNT(*)
  INTO _total_return_revenue, _return_profit, _products_returned
  FROM export_returns ret
  WHERE ret.tenant_id = p_tenant_id
    AND ret.fee_type = 'none'
    AND ret.return_date >= p_start_iso
    AND ret.return_date <= p_end_iso
    AND (p_branch_id IS NULL OR ret.branch_id = p_branch_id);

  _business_profit := _business_profit - _return_profit;

  -- 3. Payment sources
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

  -- 4. Cash book
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

  -- 5. Expenses by category
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

  -- 6. Profit by category
  SELECT COALESCE(jsonb_agg(row_to_json(sub) ORDER BY sub.profit DESC), '[]'::jsonb)
  INTO _profit_by_cat
  FROM (
    SELECT 
      COALESCE(eri.category_id::text, 'uncategorized') AS "categoryId",
      COALESCE(cat.name, 'Chưa phân loại') AS "categoryName",
      SUM(eri.sale_price)::numeric AS revenue,
      SUM(eri.sale_price - COALESCE(p.import_price, 0))::numeric AS profit,
      COUNT(*)::integer AS count
    FROM export_receipt_items eri
    JOIN export_receipts er ON er.id = eri.receipt_id
    LEFT JOIN products p ON p.id = eri.product_id
    LEFT JOIN categories cat ON cat.id = eri.category_id
    WHERE er.tenant_id = p_tenant_id
      AND er.status != 'cancelled'
      AND eri.status IN ('sold', 'returned')
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
$$;

-- ===================================
-- RPC: get_report_chart_aggregated
-- Server-side chart data
-- ===================================
CREATE OR REPLACE FUNCTION public.get_report_chart_aggregated(
  p_tenant_id uuid,
  p_start_iso timestamptz,
  p_end_iso timestamptz,
  p_branch_id uuid DEFAULT NULL,
  p_group_by text DEFAULT 'day'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH sales AS (
    SELECT 
      CASE 
        WHEN p_group_by = 'day' THEN to_char(er.export_date AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')
        WHEN p_group_by = 'week' THEN to_char(date_trunc('week', er.export_date AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM-DD')
        ELSE to_char(er.export_date AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM')
      END AS dt,
      SUM(eri.sale_price)::numeric AS revenue,
      SUM(eri.sale_price - COALESCE(p.import_price, 0))::numeric AS profit,
      COUNT(*)::integer AS cnt
    FROM export_receipt_items eri
    JOIN export_receipts er ON er.id = eri.receipt_id
    LEFT JOIN products p ON p.id = eri.product_id
    WHERE er.tenant_id = p_tenant_id
      AND er.status != 'cancelled'
      AND eri.status IN ('sold', 'returned')
      AND er.export_date >= p_start_iso
      AND er.export_date <= p_end_iso
      AND (p_branch_id IS NULL OR er.branch_id = p_branch_id)
    GROUP BY 1
  ),
  returns AS (
    SELECT 
      CASE 
        WHEN p_group_by = 'day' THEN to_char(ret.return_date AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')
        WHEN p_group_by = 'week' THEN to_char(date_trunc('week', ret.return_date AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM-DD')
        ELSE to_char(ret.return_date AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM')
      END AS dt,
      SUM(ret.sale_price - COALESCE(ret.import_price, 0))::numeric AS return_profit,
      COUNT(*)::integer AS cnt
    FROM export_returns ret
    WHERE ret.tenant_id = p_tenant_id
      AND ret.fee_type = 'none'
      AND ret.return_date >= p_start_iso
      AND ret.return_date <= p_end_iso
      AND (p_branch_id IS NULL OR ret.branch_id = p_branch_id)
    GROUP BY 1
  ),
  combined AS (
    SELECT 
      COALESCE(s.dt, r.dt) AS date,
      COALESCE(s.revenue, 0) AS revenue,
      COALESCE(s.profit, 0) - COALESCE(r.return_profit, 0) AS profit,
      COALESCE(s.cnt, 0) + COALESCE(r.cnt, 0) AS count
    FROM sales s
    FULL OUTER JOIN returns r ON s.dt = r.dt
  )
  SELECT COALESCE(jsonb_agg(row_to_json(combined) ORDER BY combined.date), '[]'::jsonb)
  INTO result
  FROM combined;

  RETURN result;
END;
$$;