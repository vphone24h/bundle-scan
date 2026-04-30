CREATE TABLE public.paid_leave_default_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  days_of_month INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE public.paid_leave_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  leave_dates DATE[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, year, month)
);

CREATE INDEX idx_paid_leave_default_user ON public.paid_leave_default_dates(user_id);
CREATE INDEX idx_paid_leave_override_user_period ON public.paid_leave_overrides(user_id, year, month);

ALTER TABLE public.paid_leave_default_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paid_leave_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins manage default leave dates"
ON public.paid_leave_default_dates
FOR ALL
USING (
  tenant_id = public.get_user_tenant_id_secure()
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Users view own default leave dates"
ON public.paid_leave_default_dates
FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id_secure()
  AND user_id = auth.uid()
);

CREATE POLICY "Tenant admins manage leave overrides"
ON public.paid_leave_overrides
FOR ALL
USING (
  tenant_id = public.get_user_tenant_id_secure()
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Users view own leave overrides"
ON public.paid_leave_overrides
FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id_secure()
  AND user_id = auth.uid()
);

CREATE TRIGGER trg_paid_leave_default_updated_at
BEFORE UPDATE ON public.paid_leave_default_dates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_paid_leave_override_updated_at
BEFORE UPDATE ON public.paid_leave_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();