
CREATE TABLE public.customer_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  note TEXT,
  rated_by UUID,
  rated_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_ratings_customer ON public.customer_ratings(customer_id, created_at DESC);
CREATE INDEX idx_customer_ratings_tenant ON public.customer_ratings(tenant_id);

ALTER TABLE public.customer_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view ratings in their tenant"
ON public.customer_ratings FOR SELECT
USING (tenant_id = public.get_user_tenant_id_secure());

CREATE POLICY "Users insert ratings in their tenant"
ON public.customer_ratings FOR INSERT
WITH CHECK (tenant_id = public.get_user_tenant_id_secure());

CREATE POLICY "Users update ratings in their tenant"
ON public.customer_ratings FOR UPDATE
USING (tenant_id = public.get_user_tenant_id_secure());

CREATE POLICY "Users delete ratings in their tenant"
ON public.customer_ratings FOR DELETE
USING (tenant_id = public.get_user_tenant_id_secure());

CREATE TRIGGER update_customer_ratings_updated_at
BEFORE UPDATE ON public.customer_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
