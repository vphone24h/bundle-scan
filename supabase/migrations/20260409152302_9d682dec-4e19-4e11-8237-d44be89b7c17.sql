
-- Salary templates (mẫu lương)
CREATE TABLE public.salary_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  salary_type TEXT NOT NULL DEFAULT 'fixed' CHECK (salary_type IN ('fixed','hourly','daily','shift')),
  base_amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salary_templates_tenant_isolation" ON public.salary_templates
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

-- Employee salary configs
CREATE TABLE public.employee_salary_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  salary_template_id UUID REFERENCES public.salary_templates(id) ON DELETE SET NULL,
  custom_base_amount NUMERIC,
  allowances JSONB NOT NULL DEFAULT '[]',
  deductions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.employee_salary_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_salary_configs_tenant" ON public.employee_salary_configs
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

-- Commission rules
CREATE TABLE public.commission_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'revenue' CHECK (rule_type IN ('product','category','revenue')),
  target_id UUID,
  target_name TEXT,
  commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage','fixed')),
  commission_value NUMERIC NOT NULL DEFAULT 0,
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  applies_to_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_rules_tenant" ON public.commission_rules
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

-- Payroll periods (kỳ lương)
CREATE TABLE public.payroll_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('weekly','biweekly','monthly')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','paid','cancelled')),
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_periods_tenant" ON public.payroll_periods
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

-- Payroll records (bảng lương chi tiết)
CREATE TABLE public.payroll_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payroll_period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT,
  total_work_days NUMERIC NOT NULL DEFAULT 0,
  total_work_hours NUMERIC NOT NULL DEFAULT 0,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  total_commission NUMERIC NOT NULL DEFAULT 0,
  total_allowance NUMERIC NOT NULL DEFAULT 0,
  total_deduction NUMERIC NOT NULL DEFAULT 0,
  total_bonus NUMERIC NOT NULL DEFAULT 0,
  net_salary NUMERIC NOT NULL DEFAULT 0,
  commission_details JSONB DEFAULT '[]',
  allowance_details JSONB DEFAULT '[]',
  deduction_details JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','paid')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

-- Admin sees all in tenant
CREATE POLICY "payroll_records_admin" ON public.payroll_records
  FOR ALL USING (
    tenant_id IN (
      SELECT pu.tenant_id FROM public.platform_users pu
      JOIN public.user_roles ur ON ur.user_id = pu.user_id AND ur.tenant_id = pu.tenant_id
      WHERE pu.user_id = auth.uid() AND ur.user_role IN ('super_admin','branch_admin')
    )
  );

-- Staff sees own records only
CREATE POLICY "payroll_records_own" ON public.payroll_records
  FOR SELECT USING (user_id = auth.uid());

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_salary_templates_updated BEFORE UPDATE ON public.salary_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_employee_salary_configs_updated BEFORE UPDATE ON public.employee_salary_configs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_commission_rules_updated BEFORE UPDATE ON public.commission_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payroll_periods_updated BEFORE UPDATE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payroll_records_updated BEFORE UPDATE ON public.payroll_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
