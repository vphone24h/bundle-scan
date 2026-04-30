-- 1. Toggle on tenants
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS interest_enabled boolean NOT NULL DEFAULT false;

-- 2. Interest config per entity (customer/supplier)
CREATE TABLE IF NOT EXISTS public.debt_interest_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('customer','supplier')),
  entity_id uuid NOT NULL,
  monthly_rate_percent numeric NOT NULL DEFAULT 0,
  start_date timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_debt_interest_configs_entity 
  ON public.debt_interest_configs(tenant_id, entity_type, entity_id);

ALTER TABLE public.debt_interest_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members can view interest configs"
  ON public.debt_interest_configs FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE POLICY "tenant members can insert interest configs"
  ON public.debt_interest_configs FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE POLICY "tenant members can update interest configs"
  ON public.debt_interest_configs FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE POLICY "tenant members can delete interest configs"
  ON public.debt_interest_configs FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

-- 3. Interest payments (đóng lãi)
CREATE TABLE IF NOT EXISTS public.debt_interest_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('customer','supplier')),
  entity_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  note text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debt_interest_payments_entity 
  ON public.debt_interest_payments(tenant_id, entity_type, entity_id, paid_at);

ALTER TABLE public.debt_interest_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members can view interest payments"
  ON public.debt_interest_payments FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE POLICY "tenant members can insert interest payments"
  ON public.debt_interest_payments FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE POLICY "tenant members can update interest payments"
  ON public.debt_interest_payments FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE POLICY "tenant members can delete interest payments"
  ON public.debt_interest_payments FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

-- updated_at trigger for configs
CREATE TRIGGER update_debt_interest_configs_updated_at
  BEFORE UPDATE ON public.debt_interest_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();