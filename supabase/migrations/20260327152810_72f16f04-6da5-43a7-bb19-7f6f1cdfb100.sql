
-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can manage payments" ON receipt_payments;
DROP POLICY IF EXISTS "Authenticated users can view payments" ON receipt_payments;

-- Create tenant-scoped SELECT policy
CREATE POLICY "Users can view own tenant receipt payments"
ON receipt_payments FOR SELECT TO authenticated
USING (
  is_platform_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM import_receipts ir 
    WHERE ir.id = receipt_payments.receipt_id 
    AND ir.tenant_id = get_user_tenant_id_secure()
  )
);

-- Create tenant-scoped INSERT policy
CREATE POLICY "Users can insert own tenant receipt payments"
ON receipt_payments FOR INSERT TO authenticated
WITH CHECK (
  is_platform_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM import_receipts ir 
    WHERE ir.id = receipt_payments.receipt_id 
    AND ir.tenant_id = get_user_tenant_id_secure()
  )
);

-- Create tenant-scoped UPDATE policy
CREATE POLICY "Users can update own tenant receipt payments"
ON receipt_payments FOR UPDATE TO authenticated
USING (
  is_platform_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM import_receipts ir 
    WHERE ir.id = receipt_payments.receipt_id 
    AND ir.tenant_id = get_user_tenant_id_secure()
  )
);

-- Create tenant-scoped DELETE policy
CREATE POLICY "Users can delete own tenant receipt payments"
ON receipt_payments FOR DELETE TO authenticated
USING (
  is_platform_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM import_receipts ir 
    WHERE ir.id = receipt_payments.receipt_id 
    AND ir.tenant_id = get_user_tenant_id_secure()
  )
);
