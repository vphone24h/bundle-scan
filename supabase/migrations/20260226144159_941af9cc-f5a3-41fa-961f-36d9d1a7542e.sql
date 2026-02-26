
CREATE TABLE public.custom_payment_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  source_key TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(tenant_id, source_key)
);

ALTER TABLE public.custom_payment_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant payment sources"
  ON public.custom_payment_sources FOR SELECT
  USING (tenant_id = (SELECT get_user_tenant_id_secure()));

CREATE POLICY "Users can create payment sources for their tenant"
  ON public.custom_payment_sources FOR INSERT
  WITH CHECK (tenant_id = (SELECT get_user_tenant_id_secure()));

CREATE POLICY "Users can delete their tenant payment sources"
  ON public.custom_payment_sources FOR DELETE
  USING (tenant_id = (SELECT get_user_tenant_id_secure()));
