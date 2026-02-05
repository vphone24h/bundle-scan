-- Create table to store tax policy article content
CREATE TABLE public.tax_policy_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  title TEXT NOT NULL DEFAULT 'Mức Thuế 2026',
  content TEXT,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.tax_policy_articles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view tax articles of their tenant"
ON public.tax_policy_articles
FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage tax articles"
ON public.tax_policy_articles
FOR ALL
USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_tax_policy_articles_updated_at
BEFORE UPDATE ON public.tax_policy_articles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();