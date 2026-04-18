DROP POLICY IF EXISTS "Users can view company-scoped custom_domains" ON public.custom_domains;

CREATE POLICY "Users can view company-scoped custom_domains"
ON public.custom_domains
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = custom_domains.tenant_id
      AND t.company_id = public.get_user_company_id()
  )
);