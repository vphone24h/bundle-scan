
-- Create landing_product_packages table
CREATE TABLE public.landing_product_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.landing_products(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price BIGINT NOT NULL DEFAULT 0,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup by product
CREATE INDEX idx_landing_product_packages_product ON public.landing_product_packages(product_id);
CREATE INDEX idx_landing_product_packages_tenant ON public.landing_product_packages(tenant_id);

-- Enable RLS
ALTER TABLE public.landing_product_packages ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can see active packages (for storefront)
CREATE POLICY "Anyone can view active packages"
ON public.landing_product_packages
FOR SELECT
USING (is_active = true);

-- Authenticated users can manage packages for their tenant
CREATE POLICY "Tenant users can insert packages"
ON public.landing_product_packages
FOR INSERT
TO authenticated
WITH CHECK (tenant_id IN (SELECT get_user_tenant_id_secure()));

CREATE POLICY "Tenant users can update packages"
ON public.landing_product_packages
FOR UPDATE
TO authenticated
USING (tenant_id IN (SELECT get_user_tenant_id_secure()));

CREATE POLICY "Tenant users can delete packages"
ON public.landing_product_packages
FOR DELETE
TO authenticated
USING (tenant_id IN (SELECT get_user_tenant_id_secure()));

-- Add selected_packages column to landing_orders to store chosen packages
ALTER TABLE public.landing_orders
ADD COLUMN selected_packages JSONB DEFAULT '[]'::jsonb;
