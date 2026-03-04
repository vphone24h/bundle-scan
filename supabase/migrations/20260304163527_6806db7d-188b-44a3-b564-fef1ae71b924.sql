
-- =============================================
-- PHASE 1B: DAILY_STATS TABLE FOR DASHBOARD
-- =============================================

CREATE TABLE IF NOT EXISTS public.daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id),
  stat_date date NOT NULL,
  total_orders integer DEFAULT 0,
  total_revenue numeric DEFAULT 0,
  total_profit numeric DEFAULT 0,
  total_sold_items integer DEFAULT 0,
  total_imports integer DEFAULT 0,
  total_expenses numeric DEFAULT 0,
  total_other_income numeric DEFAULT 0,
  new_customers integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, branch_id, stat_date)
);

-- Handle NULL branch_id uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_stats_tenant_null_branch_date 
  ON public.daily_stats (tenant_id, stat_date) WHERE branch_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_daily_stats_tenant_date 
  ON public.daily_stats (tenant_id, stat_date DESC);

ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant daily_stats" ON public.daily_stats
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

-- =============================================
-- FUNCTION: Rebuild daily_stats for a tenant+date
-- =============================================
CREATE OR REPLACE FUNCTION public.rebuild_daily_stats(
  _tenant_id uuid, 
  _stat_date date,
  _branch_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _date_start timestamptz;
  _date_end timestamptz;
  _total_orders integer := 0;
  _total_revenue numeric := 0;
  _total_profit numeric := 0;
  _total_sold integer := 0;
  _total_imports integer := 0;
  _total_expenses numeric := 0;
  _total_income numeric := 0;
  _new_customers integer := 0;
BEGIN
  _date_start := _stat_date::timestamptz;
  _date_end := (_stat_date + INTERVAL '1 day')::timestamptz;

  -- Export receipts (orders)
  SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
  INTO _total_orders, _total_revenue
  FROM export_receipts
  WHERE tenant_id = _tenant_id
    AND status != 'cancelled'
    AND export_date >= _date_start AND export_date < _date_end
    AND (_branch_id IS NULL OR branch_id = _branch_id);

  -- Sold items count + profit
  SELECT COUNT(*), COALESCE(SUM(eri.sale_price - COALESCE(p.import_price, 0)), 0)
  INTO _total_sold, _total_profit
  FROM export_receipt_items eri
  JOIN export_receipts er ON er.id = eri.receipt_id
  LEFT JOIN products p ON p.id = eri.product_id
  WHERE er.tenant_id = _tenant_id
    AND er.status != 'cancelled'
    AND eri.status IN ('sold', 'returned')
    AND er.export_date >= _date_start AND er.export_date < _date_end
    AND (_branch_id IS NULL OR er.branch_id = _branch_id);

  -- Subtract returns without fee
  SELECT COALESCE(SUM(ret.sale_price - COALESCE(p2.import_price, 0)), 0)
  INTO _total_revenue -- reusing variable temporarily
  FROM export_returns ret
  LEFT JOIN products p2 ON p2.id = ret.product_id
  WHERE ret.tenant_id = _tenant_id
    AND ret.fee_type = 'none'
    AND ret.return_date >= _date_start AND ret.return_date < _date_end
    AND (_branch_id IS NULL OR ret.branch_id = _branch_id);
  
  _total_profit := _total_profit - _total_revenue;
  
  -- Re-fetch revenue (was overwritten)
  SELECT COALESCE(SUM(total_amount), 0) INTO _total_revenue
  FROM export_receipts
  WHERE tenant_id = _tenant_id AND status != 'cancelled'
    AND export_date >= _date_start AND export_date < _date_end
    AND (_branch_id IS NULL OR branch_id = _branch_id);

  -- Import receipts
  SELECT COUNT(*) INTO _total_imports
  FROM import_receipts
  WHERE tenant_id = _tenant_id
    AND import_date >= _date_start AND import_date < _date_end
    AND (_branch_id IS NULL OR branch_id = _branch_id);

  -- Cash book expenses & income
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)
  INTO _total_expenses, _total_income
  FROM cash_book
  WHERE tenant_id = _tenant_id
    AND is_business_accounting = true
    AND transaction_date >= _date_start AND transaction_date < _date_end
    AND (_branch_id IS NULL OR branch_id = _branch_id);

  _total_profit := (_total_profit + _total_income) - _total_expenses;

  -- New customers
  SELECT COUNT(*) INTO _new_customers
  FROM customers
  WHERE tenant_id = _tenant_id
    AND created_at >= _date_start AND created_at < _date_end
    AND (_branch_id IS NULL OR preferred_branch_id = _branch_id);

  -- Upsert
  INSERT INTO daily_stats (
    tenant_id, branch_id, stat_date,
    total_orders, total_revenue, total_profit, total_sold_items,
    total_imports, total_expenses, total_other_income, new_customers, updated_at
  ) VALUES (
    _tenant_id, _branch_id, _stat_date,
    _total_orders, _total_revenue, _total_profit, _total_sold,
    _total_imports, _total_expenses, _total_income, _new_customers, now()
  )
  ON CONFLICT (tenant_id, branch_id, stat_date) 
  DO UPDATE SET
    total_orders = EXCLUDED.total_orders,
    total_revenue = EXCLUDED.total_revenue,
    total_profit = EXCLUDED.total_profit,
    total_sold_items = EXCLUDED.total_sold_items,
    total_imports = EXCLUDED.total_imports,
    total_expenses = EXCLUDED.total_expenses,
    total_other_income = EXCLUDED.total_other_income,
    new_customers = EXCLUDED.new_customers,
    updated_at = now();
END;
$$;

-- =============================================
-- FUNCTION: Rebuild daily stats for all tenants for today
-- =============================================
CREATE OR REPLACE FUNCTION public.rebuild_all_daily_stats_today()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant RECORD;
BEGIN
  FOR _tenant IN SELECT id FROM tenants WHERE status IN ('active', 'trial') LOOP
    PERFORM rebuild_daily_stats(_tenant.id, CURRENT_DATE, NULL);
  END LOOP;
END;
$$;
