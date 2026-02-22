-- Fix export_receipt_items policies: change from 'public' role to 'authenticated' role
DROP POLICY IF EXISTS "Users can view own tenant export receipt items" ON public.export_receipt_items;
CREATE POLICY "Users can view own tenant export receipt items"
ON public.export_receipt_items FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()) OR (EXISTS (
  SELECT 1 FROM export_receipts er
  WHERE er.id = export_receipt_items.receipt_id
  AND er.tenant_id = get_user_tenant_id_secure()
)));

DROP POLICY IF EXISTS "Users can insert own tenant export receipt items" ON public.export_receipt_items;
CREATE POLICY "Users can insert own tenant export receipt items"
ON public.export_receipt_items FOR INSERT TO authenticated
WITH CHECK (is_platform_admin(auth.uid()) OR (EXISTS (
  SELECT 1 FROM export_receipts er
  WHERE er.id = export_receipt_items.receipt_id
  AND er.tenant_id = get_user_tenant_id_secure()
)));

DROP POLICY IF EXISTS "Users can update own tenant export receipt items" ON public.export_receipt_items;
CREATE POLICY "Users can update own tenant export receipt items"
ON public.export_receipt_items FOR UPDATE TO authenticated
USING (is_platform_admin(auth.uid()) OR (EXISTS (
  SELECT 1 FROM export_receipts er
  WHERE er.id = export_receipt_items.receipt_id
  AND er.tenant_id = get_user_tenant_id_secure()
)));

DROP POLICY IF EXISTS "Users can delete own tenant export receipt items" ON public.export_receipt_items;
CREATE POLICY "Users can delete own tenant export receipt items"
ON public.export_receipt_items FOR DELETE TO authenticated
USING (is_platform_admin(auth.uid()) OR (EXISTS (
  SELECT 1 FROM export_receipts er
  WHERE er.id = export_receipt_items.receipt_id
  AND er.tenant_id = get_user_tenant_id_secure()
)));