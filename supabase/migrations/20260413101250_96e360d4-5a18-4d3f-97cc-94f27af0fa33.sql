-- Fix: stock_transfer_items INSERT policy was admin-only, now allows users with transfer_stock permission
DROP POLICY IF EXISTS "Admins can insert transfer items" ON public.stock_transfer_items;

CREATE POLICY "Users with transfer permission can insert items"
ON public.stock_transfer_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stock_transfer_requests r
    WHERE r.id = transfer_request_id
    AND public.user_belongs_to_tenant(r.tenant_id)
    AND public.can_transfer_stock(auth.uid())
  )
);