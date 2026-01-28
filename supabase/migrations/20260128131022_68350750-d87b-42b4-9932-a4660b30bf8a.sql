-- Fix customers table RLS: Restrict SELECT to authorized roles only
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Tenant users can view customers" ON public.customers;

-- Create stricter SELECT policy - only roles that need customer access
CREATE POLICY "Authorized roles can view customers" 
ON public.customers 
FOR SELECT 
USING (
  is_platform_admin(auth.uid()) 
  OR (
    tenant_id = get_user_tenant_id_secure() 
    AND can_access_cash_book(auth.uid())
  )
);

-- Add comment explaining the security rationale
COMMENT ON POLICY "Authorized roles can view customers" ON public.customers IS 
'Restricts customer PII access to super_admin, branch_admin, and cashier roles only. Staff role cannot view customer data.';