
CREATE TABLE public.absence_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  absence_date DATE NOT NULL,
  is_excused BOOLEAN NOT NULL DEFAULT false,
  review_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id, absence_date)
);

ALTER TABLE public.absence_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view absence reviews in their tenant"
  ON public.absence_reviews FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert absence reviews in their tenant"
  ON public.absence_reviews FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can update absence reviews in their tenant"
  ON public.absence_reviews FOR UPDATE
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete absence reviews in their tenant"
  ON public.absence_reviews FOR DELETE
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE INDEX idx_absence_reviews_tenant_date ON public.absence_reviews(tenant_id, absence_date);
CREATE INDEX idx_absence_reviews_user ON public.absence_reviews(user_id, absence_date);
