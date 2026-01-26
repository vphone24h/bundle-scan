-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage own tenant import_returns" ON public.import_returns;
DROP POLICY IF EXISTS "Users can view own tenant import_returns" ON public.import_returns;

-- Create proper RLS policies with WITH CHECK for INSERT/UPDATE
CREATE POLICY "Users can view own tenant import_returns"
ON public.import_returns FOR SELECT
USING (
  is_platform_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id_secure()
);

CREATE POLICY "Users can insert own tenant import_returns"
ON public.import_returns FOR INSERT
WITH CHECK (
  is_platform_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id_secure()
);

CREATE POLICY "Users can update own tenant import_returns"
ON public.import_returns FOR UPDATE
USING (
  is_platform_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id_secure()
)
WITH CHECK (
  is_platform_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id_secure()
);

CREATE POLICY "Users can delete own tenant import_returns"
ON public.import_returns FOR DELETE
USING (
  is_platform_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id_secure()
);