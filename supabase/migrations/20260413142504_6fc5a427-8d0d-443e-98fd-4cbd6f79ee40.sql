
-- Create custom print templates table
CREATE TABLE public.custom_print_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Mẫu mới',
  paper_size TEXT NOT NULL DEFAULT 'A4' CHECK (paper_size IN ('A4', 'A5')),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  margin_top NUMERIC NOT NULL DEFAULT 10,
  margin_bottom NUMERIC NOT NULL DEFAULT 10,
  margin_left NUMERIC NOT NULL DEFAULT 10,
  margin_right NUMERIC NOT NULL DEFAULT 10,
  scale_percent INTEGER NOT NULL DEFAULT 100,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_print_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies using tenant isolation
CREATE POLICY "Users can view templates in their tenant"
ON public.custom_print_templates FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create templates in their tenant"
ON public.custom_print_templates FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update templates in their tenant"
ON public.custom_print_templates FOR UPDATE
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete templates in their tenant"
ON public.custom_print_templates FOR DELETE
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_custom_print_templates_updated_at
BEFORE UPDATE ON public.custom_print_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
