
-- Email automation scenarios table
CREATE TABLE public.email_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'days_after_purchase',
  trigger_days INTEGER NOT NULL DEFAULT 7,
  subject TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email content blocks
CREATE TABLE public.email_automation_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID NOT NULL REFERENCES public.email_automations(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL DEFAULT 'text',
  content JSONB NOT NULL DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email send logs
CREATE TABLE public.email_automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  automation_id UUID NOT NULL REFERENCES public.email_automations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id),
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  export_receipt_id UUID,
  subject TEXT NOT NULL,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_email_automations_tenant ON public.email_automations(tenant_id);
CREATE INDEX idx_email_automations_active ON public.email_automations(tenant_id, is_active);
CREATE INDEX idx_email_automation_blocks_automation ON public.email_automation_blocks(automation_id, display_order);
CREATE INDEX idx_email_automation_logs_tenant ON public.email_automation_logs(tenant_id, created_at DESC);
CREATE INDEX idx_email_automation_logs_automation ON public.email_automation_logs(automation_id);

-- RLS
ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_automation_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_automation_logs ENABLE ROW LEVEL SECURITY;

-- Policies for email_automations
CREATE POLICY "Tenant users can view automations" ON public.email_automations
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage automations" ON public.email_automations
  FOR ALL TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

-- Policies for email_automation_blocks
CREATE POLICY "Users can view blocks via automation" ON public.email_automation_blocks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.email_automations ea 
    WHERE ea.id = automation_id AND public.user_belongs_to_tenant(ea.tenant_id)
  ));

CREATE POLICY "Users can manage blocks via automation" ON public.email_automation_blocks
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.email_automations ea 
    WHERE ea.id = automation_id AND public.user_belongs_to_tenant(ea.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.email_automations ea 
    WHERE ea.id = automation_id AND public.user_belongs_to_tenant(ea.tenant_id)
  ));

-- Policies for email_automation_logs
CREATE POLICY "Tenant users can view logs" ON public.email_automation_logs
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "System can insert logs" ON public.email_automation_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));
