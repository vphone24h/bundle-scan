-- Add UPDATE policy for tenant owners
CREATE POLICY "Tenant owners can update own tenant"
ON public.tenants
FOR UPDATE
USING (owner_id = auth.uid() OR belongs_to_tenant(auth.uid(), id))
WITH CHECK (owner_id = auth.uid() OR belongs_to_tenant(auth.uid(), id));

-- Add policy specifically for is_data_hidden and has_data_backup fields
-- This allows users who belong to the tenant to update these specific fields