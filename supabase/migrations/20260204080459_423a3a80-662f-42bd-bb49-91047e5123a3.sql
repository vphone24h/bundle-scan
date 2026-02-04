-- Enable RLS on branches table
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view branches of their own tenant
CREATE POLICY "Users can view branches of their tenant"
ON public.branches
FOR SELECT
USING (public.user_belongs_to_tenant(tenant_id));

-- Policy: Super Admin/Branch Admin can insert branches for their tenant
CREATE POLICY "Admins can insert branches for their tenant"
ON public.branches
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id_secure()
  AND public.is_tenant_admin(auth.uid())
);

-- Policy: Super Admin/Branch Admin can update branches of their tenant
CREATE POLICY "Admins can update branches of their tenant"
ON public.branches
FOR UPDATE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.is_tenant_admin(auth.uid())
);

-- Policy: Super Admin can delete branches of their tenant
CREATE POLICY "Admins can delete branches of their tenant"
ON public.branches
FOR DELETE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.is_tenant_admin(auth.uid())
);