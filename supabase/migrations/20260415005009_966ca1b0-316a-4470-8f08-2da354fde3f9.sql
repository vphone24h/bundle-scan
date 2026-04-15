
-- Create zalo_zns_templates table
CREATE TABLE public.zalo_zns_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  template_name TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL DEFAULT 'ORDER_CREATED',
  template_data_mapping JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, template_id)
);

ALTER TABLE public.zalo_zns_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant ZNS templates"
ON public.zalo_zns_templates FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant_id_secure());

CREATE POLICY "Users can insert own tenant ZNS templates"
ON public.zalo_zns_templates FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id_secure());

CREATE POLICY "Users can update own tenant ZNS templates"
ON public.zalo_zns_templates FOR UPDATE TO authenticated
USING (tenant_id = public.get_user_tenant_id_secure());

CREATE POLICY "Users can delete own tenant ZNS templates"
ON public.zalo_zns_templates FOR DELETE TO authenticated
USING (tenant_id = public.get_user_tenant_id_secure());

-- Enhance zalo_message_logs
ALTER TABLE public.zalo_message_logs ADD COLUMN IF NOT EXISTS zns_template_id TEXT;
ALTER TABLE public.zalo_message_logs ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE public.zalo_message_logs ADD COLUMN IF NOT EXISTS zalo_response JSONB;

-- Indexes
CREATE INDEX idx_zalo_zns_templates_tenant_event ON public.zalo_zns_templates(tenant_id, event_type) WHERE is_active = true;
CREATE INDEX idx_zalo_message_logs_tenant_status ON public.zalo_message_logs(tenant_id, status);
