
DROP POLICY IF EXISTS "Users can update draft stock_counts" ON public.stock_counts;

CREATE POLICY "Users can update draft stock_counts"
ON public.stock_counts
FOR UPDATE
USING (
  (is_platform_admin(auth.uid()) OR (tenant_id = get_user_tenant_id_secure()))
  AND (status = 'draft' OR has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  is_platform_admin(auth.uid()) OR (tenant_id = get_user_tenant_id_secure())
);
