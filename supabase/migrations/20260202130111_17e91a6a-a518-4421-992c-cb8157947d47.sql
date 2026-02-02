-- Fix RLS for point_settings to match current user_role model

-- Ensure RLS is enabled
ALTER TABLE public.point_settings ENABLE ROW LEVEL SECURITY;

-- Drop old mismatched policies (if they exist)
DROP POLICY IF EXISTS "Admins can manage own tenant point_settings" ON public.point_settings;
DROP POLICY IF EXISTS "Admins can insert own tenant point_settings" ON public.point_settings;
DROP POLICY IF EXISTS "Admins can update own tenant point_settings" ON public.point_settings;
DROP POLICY IF EXISTS "Admins can delete own tenant point_settings" ON public.point_settings;

-- Keep / recreate read policy (include global NULL rows for fallback)
DROP POLICY IF EXISTS "Users can view own tenant point_settings" ON public.point_settings;
CREATE POLICY "Users can view tenant & global point_settings"
ON public.point_settings
FOR SELECT
USING (
  is_platform_admin(auth.uid())
  OR tenant_id = get_user_tenant_id_secure()
  OR tenant_id IS NULL
);

-- Allow tenant admins to insert/update/delete tenant-specific settings
CREATE POLICY "Tenant admins can insert own tenant point_settings"
ON public.point_settings
FOR INSERT
WITH CHECK (
  is_platform_admin(auth.uid())
  OR (
    tenant_id = get_user_tenant_id_secure()
    AND get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::user_role, 'branch_admin'::user_role])
  )
);

CREATE POLICY "Tenant admins can update own tenant point_settings"
ON public.point_settings
FOR UPDATE
USING (
  is_platform_admin(auth.uid())
  OR (
    tenant_id = get_user_tenant_id_secure()
    AND get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::user_role, 'branch_admin'::user_role])
  )
)
WITH CHECK (
  is_platform_admin(auth.uid())
  OR (
    tenant_id = get_user_tenant_id_secure()
    AND get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::user_role, 'branch_admin'::user_role])
  )
);

CREATE POLICY "Tenant admins can delete own tenant point_settings"
ON public.point_settings
FOR DELETE
USING (
  is_platform_admin(auth.uid())
  OR (
    tenant_id = get_user_tenant_id_secure()
    AND get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::user_role, 'branch_admin'::user_role])
  )
);
