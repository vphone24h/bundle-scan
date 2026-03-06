
CREATE TABLE public.security_passwords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  reset_otp TEXT,
  reset_otp_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.security_passwords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tenant security password"
  ON public.security_passwords FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE POLICY "Super admins can manage security password"
  ON public.security_passwords FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));
