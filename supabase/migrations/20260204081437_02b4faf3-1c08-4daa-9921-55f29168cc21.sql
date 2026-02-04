-- Clean up conflicting/leaky policies on public.branches
DROP POLICY IF EXISTS "Branches visible to tenant users" ON public.branches;
DROP POLICY IF EXISTS "Users can view own tenant branches" ON public.branches;
DROP POLICY IF EXISTS "Users can insert own tenant branches" ON public.branches;
DROP POLICY IF EXISTS "Users can update own tenant branches" ON public.branches;
DROP POLICY IF EXISTS "Users can delete own tenant branches" ON public.branches;
DROP POLICY IF EXISTS "Users can manage own tenant branches" ON public.branches;

-- Ensure the intended policies exist (idempotent)
DROP POLICY IF EXISTS "Users can view branches of their tenant" ON public.branches;
CREATE POLICY "Users can view branches of their tenant"
ON public.branches
FOR SELECT
USING (
  tenant_id IS NOT NULL
  AND public.user_belongs_to_tenant(tenant_id)
);

DROP POLICY IF EXISTS "Admins can insert branches for their tenant" ON public.branches;
CREATE POLICY "Admins can insert branches for their tenant"
ON public.branches
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id_secure()
  AND public.is_tenant_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can update branches of their tenant" ON public.branches;
CREATE POLICY "Admins can update branches of their tenant"
ON public.branches
FOR UPDATE
USING (
  tenant_id IS NOT NULL
  AND public.user_belongs_to_tenant(tenant_id)
  AND public.is_tenant_admin(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id_secure()
);

DROP POLICY IF EXISTS "Admins can delete branches of their tenant" ON public.branches;
CREATE POLICY "Admins can delete branches of their tenant"
ON public.branches
FOR DELETE
USING (
  tenant_id IS NOT NULL
  AND public.user_belongs_to_tenant(tenant_id)
  AND public.is_tenant_admin(auth.uid())
);

-- One default branch per tenant
CREATE UNIQUE INDEX IF NOT EXISTS branches_one_default_per_tenant
ON public.branches (tenant_id)
WHERE (COALESCE(is_default, false) = true);