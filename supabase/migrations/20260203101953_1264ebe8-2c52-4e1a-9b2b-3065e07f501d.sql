-- =============================================
-- FIX SECURITY VULNERABILITIES (v2)
-- =============================================

-- 1. FIX tenants table - Remove public access
DROP POLICY IF EXISTS "Platform admins can view all tenants" ON public.tenants;
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;

CREATE POLICY "Users can view their own tenant"
ON public.tenants FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = auth.uid()
    AND platform_role = 'platform_admin'
  )
);

-- 2. FIX branches table - Only visible to same tenant users
DROP POLICY IF EXISTS "Branches visible to tenant users" ON public.branches;

CREATE POLICY "Branches visible to tenant users"
ON public.branches FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()
  )
  OR tenant_id IS NULL
);

-- 3. FIX advertisements table
DROP POLICY IF EXISTS "View advertisements" ON public.advertisements;

CREATE POLICY "View advertisements"
ON public.advertisements FOR SELECT
USING (
  tenant_id IS NULL
  OR (
    auth.uid() IS NOT NULL AND tenant_id IN (
      SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()
    )
  )
);

-- 4. FIX affiliate_referrals - Strict tenant isolation  
DROP POLICY IF EXISTS "Affiliates can view own referrals with tenant check" ON public.affiliate_referrals;
DROP POLICY IF EXISTS "Platform admins can view all referrals" ON public.affiliate_referrals;

CREATE POLICY "Referrals visible to affiliates and admins"
ON public.affiliate_referrals FOR SELECT
TO authenticated
USING (
  affiliate_id IN (
    SELECT id FROM public.affiliates 
    WHERE user_id = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = auth.uid()
    AND platform_role = 'platform_admin'
  )
);

-- 5. FIX customers table - Ensure strict tenant isolation
DROP POLICY IF EXISTS "Customers visible to same tenant users only" ON public.customers;
DROP POLICY IF EXISTS "Users can insert customers in their tenant" ON public.customers;
DROP POLICY IF EXISTS "Users can update customers in their tenant" ON public.customers;
DROP POLICY IF EXISTS "Users can delete customers in their tenant" ON public.customers;

CREATE POLICY "Customers visible to same tenant"
ON public.customers FOR SELECT
TO authenticated
USING (
  tenant_id = (
    SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid() LIMIT 1
  )
);

CREATE POLICY "Insert customers in own tenant"
ON public.customers FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (
    SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid() LIMIT 1
  )
);

CREATE POLICY "Update customers in own tenant"
ON public.customers FOR UPDATE
TO authenticated
USING (
  tenant_id = (
    SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid() LIMIT 1
  )
);

CREATE POLICY "Delete customers in own tenant"
ON public.customers FOR DELETE
TO authenticated
USING (
  tenant_id = (
    SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid() LIMIT 1
  )
);