CREATE POLICY "Company admins can add custom_domains for their tenants"
ON public.custom_domains
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    JOIN public.platform_users pu ON pu.user_id = auth.uid()
    WHERE t.id = custom_domains.tenant_id
      AND pu.platform_role = 'company_admin'::platform_role
      AND t.company_id = pu.company_id
  )
);

CREATE POLICY "Company admins can update custom_domains of their tenants"
ON public.custom_domains
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    JOIN public.platform_users pu ON pu.user_id = auth.uid()
    WHERE t.id = custom_domains.tenant_id
      AND pu.platform_role = 'company_admin'::platform_role
      AND t.company_id = pu.company_id
  )
);

CREATE POLICY "Company admins can view custom_domains of their tenants"
ON public.custom_domains
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    JOIN public.platform_users pu ON pu.user_id = auth.uid()
    WHERE t.id = custom_domains.tenant_id
      AND pu.platform_role = 'company_admin'::platform_role
      AND t.company_id = pu.company_id
  )
);