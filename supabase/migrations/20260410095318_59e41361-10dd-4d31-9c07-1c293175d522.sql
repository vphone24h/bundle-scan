
-- Add toggle fields to salary_templates
ALTER TABLE public.salary_templates
  ADD COLUMN IF NOT EXISTS bonus_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allowance_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS holiday_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS penalty_enabled boolean NOT NULL DEFAULT false;

-- ============ BONUS CONFIG ============
CREATE TABLE public.salary_template_bonuses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.salary_templates(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bonus_type text NOT NULL DEFAULT 'fixed',
  -- bonus_type: 'fixed', 'kpi_personal', 'branch_revenue', 'overtime', 'gross_profit'
  name text NOT NULL DEFAULT '',
  calc_type text NOT NULL DEFAULT 'fixed_amount',
  -- calc_type: 'fixed_amount', 'percentage'
  value numeric NOT NULL DEFAULT 0,
  threshold numeric DEFAULT 0,
  -- For KPI: threshold = doanh thu tối thiểu để đạt mức này
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_template_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage bonuses" ON public.salary_template_bonuses
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- ============ COMMISSION CONFIG ============
CREATE TABLE public.salary_template_commissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.salary_templates(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  target_type text NOT NULL DEFAULT 'product',
  -- target_type: 'product', 'service', 'category'
  target_id uuid,
  target_name text NOT NULL DEFAULT '',
  calc_type text NOT NULL DEFAULT 'percentage',
  -- calc_type: 'percentage', 'fixed_amount'
  value numeric NOT NULL DEFAULT 0,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_template_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage commissions" ON public.salary_template_commissions
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- ============ ALLOWANCE CONFIG ============
CREATE TABLE public.salary_template_allowances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.salary_templates(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  -- e.g. 'fuel', 'lunch', 'phone', 'responsibility', 'custom'
  allowance_type text NOT NULL DEFAULT 'custom',
  amount numeric NOT NULL DEFAULT 0,
  is_fixed boolean NOT NULL DEFAULT true,
  -- is_fixed: true = cố định tháng, false = nhập tay
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_template_allowances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage allowances" ON public.salary_template_allowances
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- ============ HOLIDAY CONFIG ============
CREATE TABLE public.salary_template_holidays (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.salary_templates(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  holiday_name text NOT NULL DEFAULT '',
  holiday_date text NOT NULL DEFAULT '',
  -- e.g. '04-30', '01-01', 'tet' for lunar new year
  multiplier_percent numeric NOT NULL DEFAULT 200,
  -- e.g. 200 = lương x2, 400 = lương x4
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_template_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage holidays" ON public.salary_template_holidays
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- ============ PENALTY CONFIG ============
CREATE TABLE public.salary_template_penalties (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.salary_templates(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  penalty_type text NOT NULL DEFAULT 'late',
  -- penalty_type: 'late', 'early_leave', 'absent_no_permission', 'violation'
  name text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  description text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_template_penalties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage penalties" ON public.salary_template_penalties
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- ============ UPDATE PAYROLL RECORDS ============
ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS total_penalty numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS holiday_bonus numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_pay numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_deduction numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS config_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS bonus_details jsonb,
  ADD COLUMN IF NOT EXISTS commission_details jsonb,
  ADD COLUMN IF NOT EXISTS allowance_details_v2 jsonb,
  ADD COLUMN IF NOT EXISTS penalty_details jsonb,
  ADD COLUMN IF NOT EXISTS holiday_details jsonb,
  ADD COLUMN IF NOT EXISTS notes text;
