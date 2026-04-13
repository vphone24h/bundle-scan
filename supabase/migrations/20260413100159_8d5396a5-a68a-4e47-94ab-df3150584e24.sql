
-- Create a security definer function to check transfer_stock permission
CREATE OR REPLACE FUNCTION public.can_transfer_stock(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_tenant_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_custom_permissions
      WHERE user_id = _user_id
        AND (permissions->>'transfer_stock')::boolean = true
    );
$$;

-- Drop current policies
DROP POLICY IF EXISTS "Tenant users can create transfer requests" ON public.stock_transfer_requests;
DROP POLICY IF EXISTS "Tenant users can update transfer requests" ON public.stock_transfer_requests;

-- Only users with transfer permission can create
CREATE POLICY "Users with transfer permission can create"
ON public.stock_transfer_requests
FOR INSERT
TO authenticated
WITH CHECK (
  user_belongs_to_tenant(tenant_id)
  AND can_transfer_stock(auth.uid())
);

-- Tenant users can update (for approval flow)
CREATE POLICY "Tenant users can update transfer requests"
ON public.stock_transfer_requests
FOR UPDATE
TO authenticated
USING (user_belongs_to_tenant(tenant_id))
WITH CHECK (user_belongs_to_tenant(tenant_id));
