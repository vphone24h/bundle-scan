
CREATE TABLE public.landing_product_blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  blocked_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'blocked',
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, product_id, blocked_date)
);

ALTER TABLE public.landing_product_blocked_dates ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can see blocked dates (needed for customer booking)
CREATE POLICY "Anyone can view blocked dates"
ON public.landing_product_blocked_dates
FOR SELECT
TO anon, authenticated
USING (true);

-- Admin manage: tenant members can insert/update/delete
CREATE POLICY "Tenant admins can manage blocked dates"
ON public.landing_product_blocked_dates
FOR ALL
TO authenticated
USING (public.user_belongs_to_tenant(tenant_id))
WITH CHECK (public.user_belongs_to_tenant(tenant_id));
