-- Drop old restrictive policy
DROP POLICY IF EXISTS "Admins can update landing orders" ON landing_orders;

-- Create new policy allowing all tenant members to update orders
CREATE POLICY "Tenant members can update landing orders" ON landing_orders
  FOR UPDATE
  USING (user_belongs_to_tenant(tenant_id))
  WITH CHECK (user_belongs_to_tenant(tenant_id));