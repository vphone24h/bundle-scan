
-- Fix RLS for export_receipt_items - only allow access to items from own tenant's receipts
-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view export receipt items" ON public.export_receipt_items;
DROP POLICY IF EXISTS "Authenticated users can manage export receipt items" ON public.export_receipt_items;

-- Create new secure policies that check tenant via receipt_id
CREATE POLICY "Users can view own tenant export receipt items"
ON public.export_receipt_items
FOR SELECT
USING (
  is_platform_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.export_receipts er 
    WHERE er.id = export_receipt_items.receipt_id 
    AND er.tenant_id = get_user_tenant_id_secure()
  )
);

CREATE POLICY "Users can insert own tenant export receipt items"
ON public.export_receipt_items
FOR INSERT
WITH CHECK (
  is_platform_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.export_receipts er 
    WHERE er.id = export_receipt_items.receipt_id 
    AND er.tenant_id = get_user_tenant_id_secure()
  )
);

CREATE POLICY "Users can update own tenant export receipt items"
ON public.export_receipt_items
FOR UPDATE
USING (
  is_platform_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.export_receipts er 
    WHERE er.id = export_receipt_items.receipt_id 
    AND er.tenant_id = get_user_tenant_id_secure()
  )
)
WITH CHECK (
  is_platform_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.export_receipts er 
    WHERE er.id = export_receipt_items.receipt_id 
    AND er.tenant_id = get_user_tenant_id_secure()
  )
);

CREATE POLICY "Users can delete own tenant export receipt items"
ON public.export_receipt_items
FOR DELETE
USING (
  is_platform_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.export_receipts er 
    WHERE er.id = export_receipt_items.receipt_id 
    AND er.tenant_id = get_user_tenant_id_secure()
  )
);

-- Also fix export_receipt_payments which likely has the same issue
DROP POLICY IF EXISTS "Authenticated users can view export payments" ON public.export_receipt_payments;
DROP POLICY IF EXISTS "Authenticated users can manage export payments" ON public.export_receipt_payments;

CREATE POLICY "Users can view own tenant export receipt payments"
ON public.export_receipt_payments
FOR SELECT
USING (
  is_platform_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.export_receipts er 
    WHERE er.id = export_receipt_payments.receipt_id 
    AND er.tenant_id = get_user_tenant_id_secure()
  )
);

CREATE POLICY "Users can insert own tenant export receipt payments"
ON public.export_receipt_payments
FOR INSERT
WITH CHECK (
  is_platform_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.export_receipts er 
    WHERE er.id = export_receipt_payments.receipt_id 
    AND er.tenant_id = get_user_tenant_id_secure()
  )
);

CREATE POLICY "Users can update own tenant export receipt payments"
ON public.export_receipt_payments
FOR UPDATE
USING (
  is_platform_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.export_receipts er 
    WHERE er.id = export_receipt_payments.receipt_id 
    AND er.tenant_id = get_user_tenant_id_secure()
  )
);

CREATE POLICY "Users can delete own tenant export receipt payments"
ON public.export_receipt_payments
FOR DELETE
USING (
  is_platform_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.export_receipts er 
    WHERE er.id = export_receipt_payments.receipt_id 
    AND er.tenant_id = get_user_tenant_id_secure()
  )
);
