
CREATE TABLE public.user_custom_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

ALTER TABLE public.user_custom_permissions ENABLE ROW LEVEL SECURITY;

-- Super admin can read/write all permissions in their tenant
CREATE POLICY "super_admin_all" ON public.user_custom_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.user_role = 'super_admin'
        AND (ur.tenant_id = user_custom_permissions.tenant_id OR ur.tenant_id IS NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.user_role = 'super_admin'
        AND (ur.tenant_id = user_custom_permissions.tenant_id OR ur.tenant_id IS NULL)
    )
  );

-- Users can read their own permissions
CREATE POLICY "users_read_own" ON public.user_custom_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
