-- Fix RLS: allow tenant admins (super_admin/branch_admin) to manage user_roles within their tenant
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage own tenant user_roles" ON public.user_roles;

CREATE POLICY "Tenant admins can manage own tenant user_roles"
ON public.user_roles
FOR ALL
USING (
  public.is_platform_admin(auth.uid())
  OR (
    tenant_id = public.get_user_tenant_id_secure()
    AND public.is_tenant_admin(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    tenant_id = public.get_user_tenant_id_secure()
    AND public.is_tenant_admin(auth.uid())
  )
);
