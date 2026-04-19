CREATE POLICY "Company admins can manage platform email automations"
ON public.platform_email_automations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE platform_users.user_id = auth.uid()
      AND platform_users.platform_role = 'company_admin'::platform_role
      AND platform_users.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE platform_users.user_id = auth.uid()
      AND platform_users.platform_role = 'company_admin'::platform_role
      AND platform_users.is_active = true
  )
);