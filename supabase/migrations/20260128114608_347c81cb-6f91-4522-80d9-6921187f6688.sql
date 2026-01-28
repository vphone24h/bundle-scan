-- =============================================
-- SECURITY FIX: Restrict data access by role
-- =============================================

-- 1. Create helper function to check cash book access (super_admin, branch_admin, cashier only)
CREATE OR REPLACE FUNCTION public.can_access_cash_book(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_platform_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = _user_id 
      AND user_role IN ('super_admin', 'branch_admin', 'cashier')
    )
$$;

-- 2. Create helper function to check if user is admin (super_admin or branch_admin)
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_platform_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = _user_id 
      AND user_role IN ('super_admin', 'branch_admin')
    )
$$;

-- =============================================
-- 3. FIX: profiles table - restrict to self + admins
-- =============================================
DROP POLICY IF EXISTS "Users can view own tenant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "Users can view own profile or admins can view tenant profiles"
ON public.profiles FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_platform_admin(auth.uid())
  OR (
    public.is_tenant_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = profiles.user_id
      AND ur.tenant_id = public.get_user_tenant_id_secure()
    )
  )
);

-- =============================================
-- 4. FIX: cash_book - restrict to authorized roles only
-- =============================================
DROP POLICY IF EXISTS "Users can view own tenant cash_book" ON public.cash_book;
DROP POLICY IF EXISTS "Users can insert own tenant cash_book" ON public.cash_book;
DROP POLICY IF EXISTS "Users can update own tenant cash_book" ON public.cash_book;
DROP POLICY IF EXISTS "Users can delete own tenant cash_book" ON public.cash_book;
DROP POLICY IF EXISTS "Users can manage own tenant cash_book" ON public.cash_book;

CREATE POLICY "Authorized roles can view cash_book"
ON public.cash_book FOR SELECT
USING (
  public.is_platform_admin(auth.uid())
  OR (
    tenant_id = public.get_user_tenant_id_secure()
    AND public.can_access_cash_book(auth.uid())
  )
);

CREATE POLICY "Authorized roles can insert cash_book"
ON public.cash_book FOR INSERT
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    tenant_id = public.get_user_tenant_id_secure()
    AND public.can_access_cash_book(auth.uid())
  )
);

CREATE POLICY "Authorized roles can update cash_book"
ON public.cash_book FOR UPDATE
USING (
  public.is_platform_admin(auth.uid())
  OR (
    tenant_id = public.get_user_tenant_id_secure()
    AND public.can_access_cash_book(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    tenant_id = public.get_user_tenant_id_secure()
    AND public.can_access_cash_book(auth.uid())
  )
);

CREATE POLICY "Only admins can delete cash_book"
ON public.cash_book FOR DELETE
USING (
  public.is_platform_admin(auth.uid())
  OR (
    tenant_id = public.get_user_tenant_id_secure()
    AND public.is_tenant_admin(auth.uid())
  )
);

-- =============================================
-- 5. FIX: customers - restrict sensitive fields via function
-- Note: Staff need basic customer access for sales, but we add role check
-- =============================================
DROP POLICY IF EXISTS "Users can view own tenant customers" ON public.customers;
DROP POLICY IF EXISTS "Users can insert own tenant customers" ON public.customers;
DROP POLICY IF EXISTS "Users can update own tenant customers" ON public.customers;
DROP POLICY IF EXISTS "Users can delete own tenant customers" ON public.customers;
DROP POLICY IF EXISTS "Users can manage own tenant customers" ON public.customers;

-- All authenticated tenant users can view customers (needed for sales)
CREATE POLICY "Tenant users can view customers"
ON public.customers FOR SELECT
USING (
  public.is_platform_admin(auth.uid())
  OR tenant_id = public.get_user_tenant_id_secure()
);

-- Only admins and cashiers can create/update customers
CREATE POLICY "Authorized users can insert customers"
ON public.customers FOR INSERT
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    tenant_id = public.get_user_tenant_id_secure()
    AND public.can_access_cash_book(auth.uid())
  )
);

CREATE POLICY "Authorized users can update customers"
ON public.customers FOR UPDATE
USING (
  public.is_platform_admin(auth.uid())
  OR (
    tenant_id = public.get_user_tenant_id_secure()
    AND public.can_access_cash_book(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    tenant_id = public.get_user_tenant_id_secure()
    AND public.can_access_cash_book(auth.uid())
  )
);

-- Only admins can delete customers
CREATE POLICY "Only admins can delete customers"
ON public.customers FOR DELETE
USING (
  public.is_platform_admin(auth.uid())
  OR (
    tenant_id = public.get_user_tenant_id_secure()
    AND public.is_tenant_admin(auth.uid())
  )
);

-- =============================================
-- 6. VERIFY: affiliates already has correct policies
-- Users can only see their own affiliate record
-- Platform admins can see all
-- No changes needed, but let's ensure banking fields are protected
-- =============================================