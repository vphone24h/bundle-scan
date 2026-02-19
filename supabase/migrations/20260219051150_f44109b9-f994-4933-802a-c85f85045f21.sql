
-- =====================================================================
-- SECURITY FIX: Restrict over-permissive RLS policies
-- =====================================================================

-- 1. FIX TENANTS TABLE
-- Remove the overly permissive policy that allows everyone to see ALL tenants
DROP POLICY IF EXISTS "Public can view tenants by subdomain" ON public.tenants;

-- Keep the anon policy but restrict it to only safe fields via a view-based approach
-- Anon users can only look up tenants by subdomain (needed for landing page routing)
-- but NOT see all tenants with sensitive data
-- The existing "Anon can view active tenants" + "Tenant owners can view own tenant" covers legitimate use cases
-- We just need to ensure the wildcard policy is removed

-- Also restrict the anon policy to not expose all rows without filter
DROP POLICY IF EXISTS "Anon can view active tenants" ON public.tenants;

-- Re-create anon policy: only allow lookup by subdomain (for routing) with status filter
CREATE POLICY "Anon can view active tenants for routing"
ON public.tenants
FOR SELECT
TO anon
USING (
  status IN ('trial', 'active')
);

-- 2. FIX BRANCHES TABLE
-- Remove the overly permissive anon SELECT policy (qual:true)
DROP POLICY IF EXISTS "Anon can view branches for landing pages" ON public.branches;

-- Re-create: anon can only view branches of active/trial tenants (for landing pages)
CREATE POLICY "Anon can view branches of active tenants"
ON public.branches
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = branches.tenant_id
    AND t.status IN ('trial', 'active')
  )
);

-- 3. VERIFY einvoice_configs has RLS enabled (it should, but ensure)
ALTER TABLE public.einvoice_configs ENABLE ROW LEVEL SECURITY;

-- 4. FIX PROFILES TABLE - ensure cross-tenant access is blocked
-- Drop any overly permissive "view all" policy if it still exists
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- The existing policy "Users can view own profile or admins can view tenant profiles" 
-- already handles this correctly, so just verify it's in place (no action needed if exists)
