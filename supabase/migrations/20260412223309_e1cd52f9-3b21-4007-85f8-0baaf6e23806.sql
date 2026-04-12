
-- Allow company admins to delete custom domains belonging to their company's tenants
CREATE POLICY "Company admins can delete custom_domains of their tenants"
ON public.custom_domains
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenants t
    JOIN public.platform_users pu ON pu.user_id = auth.uid()
    WHERE t.id = custom_domains.tenant_id
      AND pu.platform_role = 'company_admin'
      AND t.company_id = pu.company_id
  )
);

-- Allow tenant users to delete their own custom domains
CREATE POLICY "Tenant users can delete own custom_domains"
ON public.custom_domains
FOR DELETE
TO authenticated
USING (tenant_id = get_user_tenant_id_secure());
