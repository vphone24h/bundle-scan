DROP POLICY IF EXISTS "Users can view own tenant snapshots" ON public.warehouse_value_snapshots;
DROP POLICY IF EXISTS "Users can insert own tenant snapshots" ON public.warehouse_value_snapshots;

CREATE POLICY "Tenant users can view warehouse snapshots"
ON public.warehouse_value_snapshots
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id_secure()::text
);

CREATE POLICY "Tenant users can insert warehouse snapshots"
ON public.warehouse_value_snapshots
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id_secure()::text
);