
-- Table for tenant-level debt overdue settings
CREATE TABLE public.debt_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  overdue_days integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.debt_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant debt settings"
ON public.debt_settings FOR SELECT
USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can manage debt settings"
ON public.debt_settings FOR ALL
USING (public.user_belongs_to_tenant(tenant_id) AND public.is_tenant_admin(auth.uid()));

-- Add per-customer overdue days override
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS debt_due_days integer DEFAULT NULL;

-- Add per-supplier overdue days override  
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS debt_due_days integer DEFAULT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_debt_settings_updated_at
BEFORE UPDATE ON public.debt_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
