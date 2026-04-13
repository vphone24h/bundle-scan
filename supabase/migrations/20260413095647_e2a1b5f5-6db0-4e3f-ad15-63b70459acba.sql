
-- Drop old restrictive INSERT policy
DROP POLICY "Tenant admins can create transfer requests" ON public.stock_transfer_requests;

-- Allow any authenticated tenant user to create transfer requests
CREATE POLICY "Tenant users can create transfer requests"
ON public.stock_transfer_requests
FOR INSERT
WITH CHECK (user_belongs_to_tenant(tenant_id));

-- Also allow the creator to update their own pending requests
DROP POLICY "Tenant admins can update transfer requests" ON public.stock_transfer_requests;

CREATE POLICY "Tenant users can update transfer requests"
ON public.stock_transfer_requests
FOR UPDATE
USING (user_belongs_to_tenant(tenant_id))
WITH CHECK (user_belongs_to_tenant(tenant_id));
