
CREATE TABLE IF NOT EXISTS public.zalo_message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'order_confirmation',
  message_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  error_code TEXT,
  reference_id TEXT,
  reference_type TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zalo_message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view zalo logs of their tenant"
  ON public.zalo_message_logs
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert zalo logs for their tenant"
  ON public.zalo_message_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

-- Allow anon to insert (for public order flow)
CREATE POLICY "Anon can insert zalo logs"
  ON public.zalo_message_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE INDEX idx_zalo_message_logs_tenant ON public.zalo_message_logs(tenant_id, created_at DESC);
