
-- Create staff_reviews table
CREATE TABLE public.staff_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  branch_id UUID REFERENCES public.branches(id),
  staff_user_id UUID NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT,
  export_receipt_item_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_reviews ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert reviews (public-facing form)
CREATE POLICY "Anyone can insert staff_reviews"
ON public.staff_reviews
FOR INSERT
WITH CHECK (true);

-- Tenant members can read their own reviews
CREATE POLICY "Tenant members can read staff_reviews"
ON public.staff_reviews
FOR SELECT
USING (public.user_belongs_to_tenant(tenant_id));

-- Allow anonymous read for public warranty pages
CREATE POLICY "Anyone can read staff_reviews for duplicate check"
ON public.staff_reviews
FOR SELECT
USING (true);
