
CREATE TABLE public.warehouse_value_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  inventory_value NUMERIC NOT NULL DEFAULT 0,
  cash_balance NUMERIC NOT NULL DEFAULT 0,
  customer_debt NUMERIC NOT NULL DEFAULT 0,
  supplier_debt NUMERIC NOT NULL DEFAULT 0,
  total_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, branch_id, snapshot_date)
);

-- Also allow null branch_id for "all branches" snapshot
CREATE UNIQUE INDEX idx_warehouse_snapshot_all ON public.warehouse_value_snapshots (tenant_id, snapshot_date) WHERE branch_id IS NULL;

ALTER TABLE public.warehouse_value_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant snapshots"
  ON public.warehouse_value_snapshots
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert own tenant snapshots"
  ON public.warehouse_value_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  ));
