
-- =============================================
-- PHASE 1C: MATERIALIZED VIEWS FOR REPORTS
-- =============================================

-- Revenue by day per tenant
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_revenue_daily AS
SELECT 
  er.tenant_id,
  er.branch_id,
  DATE(er.export_date) AS stat_date,
  COUNT(*) AS total_orders,
  SUM(er.total_amount) AS total_revenue,
  SUM(CASE WHEN er.status = 'completed' THEN er.total_amount ELSE 0 END) AS completed_revenue
FROM public.export_receipts er
WHERE er.status != 'cancelled'
GROUP BY er.tenant_id, er.branch_id, DATE(er.export_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_revenue_daily_key 
  ON public.mv_revenue_daily (tenant_id, branch_id, stat_date);

-- Revenue by month per tenant
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_revenue_monthly AS
SELECT 
  er.tenant_id,
  er.branch_id,
  DATE_TRUNC('month', er.export_date)::date AS stat_month,
  COUNT(*) AS total_orders,
  SUM(er.total_amount) AS total_revenue
FROM public.export_receipts er
WHERE er.status != 'cancelled'
GROUP BY er.tenant_id, er.branch_id, DATE_TRUNC('month', er.export_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_revenue_monthly_key 
  ON public.mv_revenue_monthly (tenant_id, branch_id, stat_month);

-- Top products by sales count
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_top_products AS
SELECT 
  er.tenant_id,
  eri.product_name,
  eri.sku,
  COUNT(*) AS total_sold,
  SUM(eri.sale_price) AS total_revenue
FROM public.export_receipt_items eri
JOIN public.export_receipts er ON er.id = eri.receipt_id
WHERE eri.status = 'sold' AND er.status != 'cancelled'
GROUP BY er.tenant_id, eri.product_name, eri.sku;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_top_products_key 
  ON public.mv_top_products (tenant_id, product_name, sku);

-- Customer debt summary
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_customer_debt AS
SELECT 
  er.tenant_id,
  er.customer_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  SUM(er.debt_amount) AS total_remaining_debt,
  COUNT(*) AS total_receipts
FROM public.export_receipts er
JOIN public.customers c ON c.id = er.customer_id
WHERE er.status = 'completed' AND er.debt_amount > 0
GROUP BY er.tenant_id, er.customer_id, c.name, c.phone;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_customer_debt_key 
  ON public.mv_customer_debt (tenant_id, customer_id);

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_monthly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_products;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_debt;
END;
$$;
