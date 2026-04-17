
DROP POLICY IF EXISTS "Authenticated users can view stock count items" ON public.stock_count_items;
DROP POLICY IF EXISTS "Authenticated users can insert stock count items" ON public.stock_count_items;
DROP POLICY IF EXISTS "Authenticated users can update stock count items" ON public.stock_count_items;
DROP POLICY IF EXISTS "Authenticated users can delete stock count items" ON public.stock_count_items;

CREATE POLICY "Tenant users can view stock count items"
ON public.stock_count_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.stock_counts sc
    WHERE sc.id = stock_count_items.stock_count_id
      AND sc.tenant_id = public.get_user_tenant_id_secure()
  )
);

CREATE POLICY "Tenant users can insert stock count items"
ON public.stock_count_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stock_counts sc
    WHERE sc.id = stock_count_items.stock_count_id
      AND sc.tenant_id = public.get_user_tenant_id_secure()
  )
);

CREATE POLICY "Tenant users can update stock count items"
ON public.stock_count_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.stock_counts sc
    WHERE sc.id = stock_count_items.stock_count_id
      AND sc.tenant_id = public.get_user_tenant_id_secure()
  )
);

CREATE POLICY "Tenant users can delete stock count items"
ON public.stock_count_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.stock_counts sc
    WHERE sc.id = stock_count_items.stock_count_id
      AND sc.tenant_id = public.get_user_tenant_id_secure()
  )
);
