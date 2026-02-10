
CREATE POLICY "Users can update debt_tags for their tenant"
ON public.debt_tags
FOR UPDATE
USING (tenant_id = public.get_user_tenant_id_secure()::text)
WITH CHECK (tenant_id = public.get_user_tenant_id_secure()::text);
