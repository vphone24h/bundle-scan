-- Create customer_sources table to store custom customer source options
CREATE TABLE public.customer_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT customer_sources_unique_name UNIQUE (tenant_id, name)
);

-- Enable Row Level Security
ALTER TABLE public.customer_sources ENABLE ROW LEVEL SECURITY;

-- Create policies for tenant access
CREATE POLICY "Users can view their tenant's customer sources"
ON public.customer_sources
FOR SELECT
USING (tenant_id = get_user_tenant_id_secure() OR is_default = true);

CREATE POLICY "Users can create customer sources for their tenant"
ON public.customer_sources
FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can update their tenant's customer sources"
ON public.customer_sources
FOR UPDATE
USING (tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can delete their tenant's customer sources"
ON public.customer_sources
FOR DELETE
USING (tenant_id = get_user_tenant_id_secure() AND is_default = false);

-- Add source column to customers table
ALTER TABLE public.customers 
ADD COLUMN source TEXT DEFAULT NULL;

-- Insert default customer sources (available to all tenants)
INSERT INTO public.customer_sources (tenant_id, name, is_default, display_order)
VALUES 
  (NULL, 'Khách vãng lai', true, 1),
  (NULL, 'TikTok', true, 2),
  (NULL, 'Facebook', true, 3),
  (NULL, 'Zalo', true, 4);

-- Create updated_at trigger for customer_sources
CREATE TRIGGER update_customer_sources_updated_at
BEFORE UPDATE ON public.customer_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();