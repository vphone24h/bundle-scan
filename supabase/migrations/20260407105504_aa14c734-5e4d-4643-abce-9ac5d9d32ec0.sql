
-- Create helper function that checks both platform_admin and company_admin
CREATE OR REPLACE FUNCTION public.is_platform_or_company_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_users 
    WHERE user_id = _user_id 
    AND platform_role IN ('platform_admin', 'company_admin')
    AND is_active = true
  )
$$;

-- payment_config: update ALL policy
DROP POLICY IF EXISTS "Platform admins can manage payment config" ON public.payment_config;
CREATE POLICY "Platform or company admins can manage payment config"
ON public.payment_config FOR ALL
USING (is_platform_or_company_admin(auth.uid()));

-- bank_accounts: update ALL policy
DROP POLICY IF EXISTS "Platform admins can manage bank accounts" ON public.bank_accounts;
CREATE POLICY "Platform or company admins can manage bank accounts"
ON public.bank_accounts FOR ALL
USING (is_platform_or_company_admin(auth.uid()));

-- subscription_plans: update policies
DROP POLICY IF EXISTS "Platform admins can view all plans" ON public.subscription_plans;
CREATE POLICY "Platform or company admins can view all plans"
ON public.subscription_plans FOR SELECT
USING (is_platform_or_company_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can insert plans" ON public.subscription_plans;
CREATE POLICY "Platform or company admins can insert plans"
ON public.subscription_plans FOR INSERT
WITH CHECK (is_platform_or_company_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can update plans" ON public.subscription_plans;
CREATE POLICY "Platform or company admins can update plans"
ON public.subscription_plans FOR UPDATE
USING (is_platform_or_company_admin(auth.uid()))
WITH CHECK (is_platform_or_company_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can delete plans" ON public.subscription_plans;
CREATE POLICY "Platform or company admins can delete plans"
ON public.subscription_plans FOR DELETE
USING (is_platform_or_company_admin(auth.uid()));

-- affiliate_settings
DROP POLICY IF EXISTS "Platform admins can manage affiliate settings" ON public.affiliate_settings;
CREATE POLICY "Platform or company admins can manage affiliate settings"
ON public.affiliate_settings FOR ALL
USING (is_platform_or_company_admin(auth.uid()));

-- affiliate_commission_rates
DROP POLICY IF EXISTS "Platform admins can manage commission rates" ON public.affiliate_commission_rates;
CREATE POLICY "Platform or company admins can manage commission rates"
ON public.affiliate_commission_rates FOR ALL
USING (is_platform_or_company_admin(auth.uid()));

-- ad_gate_settings
DROP POLICY IF EXISTS "Platform admin can manage ad gate settings" ON public.ad_gate_settings;
CREATE POLICY "Platform or company admins can manage ad gate settings"
ON public.ad_gate_settings FOR ALL
USING (is_platform_or_company_admin(auth.uid()));

-- advertisements: update ALL policy
DROP POLICY IF EXISTS "Tenant admins can manage advertisements" ON public.advertisements;
CREATE POLICY "Admins can manage advertisements"
ON public.advertisements FOR ALL
USING (is_platform_or_company_admin(auth.uid()) OR ((tenant_id = get_user_tenant_id_secure()) AND (get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::user_role, 'branch_admin'::user_role]))));

-- system_notifications
DROP POLICY IF EXISTS "Platform admins can insert notifications" ON public.system_notifications;
CREATE POLICY "Platform or company admins can insert notifications"
ON public.system_notifications FOR INSERT
WITH CHECK (is_platform_or_company_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can update notifications" ON public.system_notifications;
CREATE POLICY "Platform or company admins can update notifications"
ON public.system_notifications FOR UPDATE
USING (is_platform_or_company_admin(auth.uid()))
WITH CHECK (is_platform_or_company_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can delete notifications" ON public.system_notifications;
CREATE POLICY "Platform or company admins can delete notifications"
ON public.system_notifications FOR DELETE
USING (is_platform_or_company_admin(auth.uid()));

-- notification_automations
DROP POLICY IF EXISTS "Platform admins can manage automations" ON public.notification_automations;
CREATE POLICY "Platform or company admins can manage automations"
ON public.notification_automations FOR ALL
USING (is_platform_or_company_admin(auth.uid()));

-- platform_articles
DROP POLICY IF EXISTS "Platform admins manage articles" ON public.platform_articles;
CREATE POLICY "Platform or company admins manage articles"
ON public.platform_articles FOR ALL TO authenticated
USING (is_platform_or_company_admin(auth.uid()))
WITH CHECK (is_platform_or_company_admin(auth.uid()));

-- platform_settings: update policy
DROP POLICY IF EXISTS "Platform admins can update platform settings" ON public.platform_settings;
CREATE POLICY "Platform or company admins can update platform settings"
ON public.platform_settings FOR UPDATE TO authenticated
USING (is_platform_or_company_admin(auth.uid()));
