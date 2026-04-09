DROP POLICY IF EXISTS "super_admin_all" ON public.user_custom_permissions;
DROP POLICY IF EXISTS "tenant_admin_manage_user_custom_permissions" ON public.user_custom_permissions;
DROP POLICY IF EXISTS "tenant_admin_read_user_custom_permissions" ON public.user_custom_permissions;
DROP POLICY IF EXISTS "users_read_own" ON public.user_custom_permissions;

CREATE POLICY "super_admin_manage_user_custom_permissions"
ON public.user_custom_permissions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.user_role = 'super_admin'
      AND (ur.tenant_id = user_custom_permissions.tenant_id OR ur.tenant_id IS NULL)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.user_role = 'super_admin'
      AND (ur.tenant_id = user_custom_permissions.tenant_id OR ur.tenant_id IS NULL)
  )
);

CREATE POLICY "tenant_admin_manage_user_custom_permissions"
ON public.user_custom_permissions
FOR ALL
TO authenticated
USING (
  public.is_tenant_admin(auth.uid())
  AND user_custom_permissions.tenant_id = public.get_user_tenant_id_secure()
)
WITH CHECK (
  public.is_tenant_admin(auth.uid())
  AND user_custom_permissions.tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "tenant_admin_read_user_custom_permissions"
ON public.user_custom_permissions
FOR SELECT
TO authenticated
USING (
  public.is_tenant_admin(auth.uid())
  AND user_custom_permissions.tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "users_read_own_user_custom_permissions"
ON public.user_custom_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());