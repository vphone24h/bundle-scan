CREATE TABLE public.landing_product_package_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.landing_products(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Gói dịch vụ kèm theo',
  selection_mode TEXT NOT NULL DEFAULT 'multiple' CHECK (selection_mode IN ('single','multiple')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lppg_product ON public.landing_product_package_groups(product_id);
CREATE INDEX idx_lppg_tenant ON public.landing_product_package_groups(tenant_id);

ALTER TABLE public.landing_product_package_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view package groups"
ON public.landing_product_package_groups FOR SELECT
USING (true);

CREATE POLICY "Tenant users can insert package groups"
ON public.landing_product_package_groups FOR INSERT
WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_id_secure()));

CREATE POLICY "Tenant users can update package groups"
ON public.landing_product_package_groups FOR UPDATE
USING (tenant_id IN (SELECT public.get_user_tenant_id_secure()));

CREATE POLICY "Tenant users can delete package groups"
ON public.landing_product_package_groups FOR DELETE
USING (tenant_id IN (SELECT public.get_user_tenant_id_secure()));

CREATE TRIGGER trg_lppg_updated_at
  BEFORE UPDATE ON public.landing_product_package_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.landing_product_packages
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.landing_product_package_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS allow_quantity BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_lpp_group ON public.landing_product_packages(group_id);