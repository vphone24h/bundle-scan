-- Fix: Allow any authenticated tenant user to INSERT cash_book entries
-- (system-generated entries from export/import receipts need this)
-- Keep SELECT/UPDATE/DELETE restricted to admin/cashier roles

DROP POLICY IF EXISTS "Authorized roles can insert cash_book" ON public.cash_book;

CREATE POLICY "Tenant users can insert cash_book"
ON public.cash_book
FOR INSERT
WITH CHECK (
  is_platform_admin(auth.uid())
  OR (tenant_id = get_user_tenant_id_secure())
);