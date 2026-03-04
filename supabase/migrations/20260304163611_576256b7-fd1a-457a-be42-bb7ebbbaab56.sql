
-- Move materialized views out of public API by revoking anon/authenticated access
REVOKE ALL ON public.mv_revenue_daily FROM anon, authenticated;
REVOKE ALL ON public.mv_revenue_monthly FROM anon, authenticated;
REVOKE ALL ON public.mv_top_products FROM anon, authenticated;
REVOKE ALL ON public.mv_customer_debt FROM anon, authenticated;

-- Create secure wrapper functions to access the data (with tenant filtering)
CREATE OR REPLACE FUNCTION public.get_revenue_daily(
  _tenant_id uuid,
  _start_date date,
  _end_date date,
  _branch_id uuid DEFAULT NULL
)
RETURNS TABLE(
  stat_date date,
  total_orders bigint,
  total_revenue numeric,
  completed_revenue numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT stat_date, total_orders, total_revenue, completed_revenue
  FROM mv_revenue_daily
  WHERE tenant_id = _tenant_id
    AND stat_date >= _start_date AND stat_date <= _end_date
    AND (_branch_id IS NULL OR branch_id = _branch_id)
  ORDER BY stat_date DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_top_products(
  _tenant_id uuid,
  _limit integer DEFAULT 20
)
RETURNS TABLE(
  product_name text,
  sku text,
  total_sold bigint,
  total_revenue numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT product_name, sku, total_sold, total_revenue
  FROM mv_top_products
  WHERE tenant_id = _tenant_id
  ORDER BY total_sold DESC
  LIMIT _limit;
$$;

CREATE OR REPLACE FUNCTION public.get_customer_debt_summary(
  _tenant_id uuid
)
RETURNS TABLE(
  customer_id uuid,
  customer_name text,
  customer_phone text,
  total_remaining_debt numeric,
  total_receipts bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT customer_id, customer_name, customer_phone, total_remaining_debt, total_receipts
  FROM mv_customer_debt
  WHERE tenant_id = _tenant_id
  ORDER BY total_remaining_debt DESC;
$$;
