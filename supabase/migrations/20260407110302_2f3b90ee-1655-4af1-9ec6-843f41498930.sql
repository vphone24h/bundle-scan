
-- Helper function to get company_id of current user
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.platform_users WHERE user_id = auth.uid() LIMIT 1
$$;

-- Add company_id to all config tables
ALTER TABLE public.payment_config ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.bank_accounts ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.subscription_plans ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.affiliate_settings ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.affiliate_commission_rates ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.ad_gate_settings ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.system_notifications ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.notification_automations ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.platform_settings ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.platform_articles ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- Create company email config table
CREATE TABLE public.company_email_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  smtp_host text,
  smtp_port integer DEFAULT 587,
  smtp_user text,
  smtp_pass text,
  from_email text,
  from_name text,
  is_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.company_email_config ENABLE ROW LEVEL SECURITY;

-- RLS for company_email_config
CREATE POLICY "Company admins can manage their email config"
ON public.company_email_config FOR ALL TO authenticated
USING (
  is_platform_admin(auth.uid()) OR 
  (company_id = get_user_company_id())
)
WITH CHECK (
  is_platform_admin(auth.uid()) OR 
  (company_id = get_user_company_id())
);

-- Now update RLS policies for all config tables to scope by company_id
-- Pattern: platform_admin sees rows where company_id IS NULL (root data)
-- company_admin sees rows where company_id = their company_id

-- payment_config
DROP POLICY IF EXISTS "Authenticated users can view payment config" ON public.payment_config;
DROP POLICY IF EXISTS "Platform or company admins can manage payment config" ON public.payment_config;

CREATE POLICY "Users can view payment config for their scope"
ON public.payment_config FOR SELECT TO authenticated
USING (
  (company_id IS NULL AND (is_platform_admin(auth.uid()) OR get_user_company_id() IS NULL))
  OR (company_id = get_user_company_id())
  OR (company_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.payment_config pc2 WHERE pc2.company_id = get_user_company_id() AND pc2.config_key = payment_config.config_key))
);

CREATE POLICY "Admins can manage payment config for their scope"
ON public.payment_config FOR ALL TO authenticated
USING (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
)
WITH CHECK (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
);

-- bank_accounts
DROP POLICY IF EXISTS "Authenticated users can view active bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Platform or company admins can manage bank accounts" ON public.bank_accounts;

CREATE POLICY "Users can view bank accounts for their scope"
ON public.bank_accounts FOR SELECT TO authenticated
USING (
  (company_id IS NULL AND (is_platform_admin(auth.uid()) OR get_user_company_id() IS NULL))
  OR (company_id = get_user_company_id())
);

CREATE POLICY "Admins can manage bank accounts for their scope"
ON public.bank_accounts FOR ALL TO authenticated
USING (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
)
WITH CHECK (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
);

-- subscription_plans
DROP POLICY IF EXISTS "Authenticated users can view active plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Platform or company admins can view all plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Platform or company admins can insert plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Platform or company admins can update plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Platform or company admins can delete plans" ON public.subscription_plans;

CREATE POLICY "Users can view plans for their scope"
ON public.subscription_plans FOR SELECT
USING (
  (company_id IS NULL AND (is_platform_admin(auth.uid()) OR get_user_company_id() IS NULL))
  OR (company_id = get_user_company_id())
  OR (is_active = true AND company_id IS NULL)
);

CREATE POLICY "Admins can manage plans for their scope"
ON public.subscription_plans FOR ALL
USING (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
)
WITH CHECK (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
);

-- affiliate_settings
DROP POLICY IF EXISTS "Authenticated users can view affiliate settings" ON public.affiliate_settings;
DROP POLICY IF EXISTS "Platform or company admins can manage affiliate settings" ON public.affiliate_settings;

CREATE POLICY "Users can view affiliate settings for their scope"
ON public.affiliate_settings FOR SELECT TO authenticated
USING (
  (company_id IS NULL AND (is_platform_admin(auth.uid()) OR get_user_company_id() IS NULL))
  OR (company_id = get_user_company_id())
);

CREATE POLICY "Admins can manage affiliate settings for their scope"
ON public.affiliate_settings FOR ALL TO authenticated
USING (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
)
WITH CHECK (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
);

-- affiliate_commission_rates
DROP POLICY IF EXISTS "Authenticated users can view commission rates" ON public.affiliate_commission_rates;
DROP POLICY IF EXISTS "Platform or company admins can manage commission rates" ON public.affiliate_commission_rates;

CREATE POLICY "Users can view commission rates for their scope"
ON public.affiliate_commission_rates FOR SELECT TO authenticated
USING (
  is_platform_admin(auth.uid()) OR is_platform_or_company_admin(auth.uid())
);

CREATE POLICY "Admins can manage commission rates for their scope"
ON public.affiliate_commission_rates FOR ALL TO authenticated
USING (
  is_platform_admin(auth.uid()) OR is_platform_or_company_admin(auth.uid())
)
WITH CHECK (
  is_platform_admin(auth.uid()) OR is_platform_or_company_admin(auth.uid())
);

-- ad_gate_settings
DROP POLICY IF EXISTS "Anyone can read ad gate settings" ON public.ad_gate_settings;
DROP POLICY IF EXISTS "Platform or company admins can manage ad gate settings" ON public.ad_gate_settings;

CREATE POLICY "Users can view ad gate settings"
ON public.ad_gate_settings FOR SELECT
USING (true);

CREATE POLICY "Admins can manage ad gate settings for their scope"
ON public.ad_gate_settings FOR ALL TO authenticated
USING (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
)
WITH CHECK (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
);

-- system_notifications
DROP POLICY IF EXISTS "Authenticated users can view active notifications" ON public.system_notifications;
DROP POLICY IF EXISTS "Platform or company admins can insert notifications" ON public.system_notifications;
DROP POLICY IF EXISTS "Platform or company admins can update notifications" ON public.system_notifications;
DROP POLICY IF EXISTS "Platform or company admins can delete notifications" ON public.system_notifications;

CREATE POLICY "Users can view notifications for their scope"
ON public.system_notifications FOR SELECT TO authenticated
USING (
  is_active = true AND (
    company_id IS NULL
    OR company_id = get_user_company_id()
  )
);

CREATE POLICY "Admins can manage notifications for their scope"
ON public.system_notifications FOR ALL TO authenticated
USING (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
)
WITH CHECK (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
);

-- notification_automations
DROP POLICY IF EXISTS "Platform or company admins can manage automations" ON public.notification_automations;

CREATE POLICY "Users can view automations for their scope"
ON public.notification_automations FOR SELECT TO authenticated
USING (
  (company_id IS NULL AND (is_platform_admin(auth.uid()) OR get_user_company_id() IS NULL))
  OR (company_id = get_user_company_id())
);

CREATE POLICY "Admins can manage automations for their scope"
ON public.notification_automations FOR ALL TO authenticated
USING (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
)
WITH CHECK (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
);

-- platform_settings
DROP POLICY IF EXISTS "Authenticated users can read platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Platform or company admins can update platform settings" ON public.platform_settings;

CREATE POLICY "Users can view platform settings for their scope"
ON public.platform_settings FOR SELECT TO authenticated
USING (
  (company_id IS NULL AND (is_platform_admin(auth.uid()) OR get_user_company_id() IS NULL))
  OR (company_id = get_user_company_id())
);

CREATE POLICY "Admins can manage platform settings for their scope"
ON public.platform_settings FOR ALL TO authenticated
USING (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
)
WITH CHECK (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
);

-- platform_articles
DROP POLICY IF EXISTS "Anyone can read published articles" ON public.platform_articles;
DROP POLICY IF EXISTS "Platform or company admins manage articles" ON public.platform_articles;

CREATE POLICY "Users can view articles for their scope"
ON public.platform_articles FOR SELECT
USING (
  (is_published = true AND (company_id IS NULL OR company_id = get_user_company_id()))
  OR is_platform_admin(auth.uid())
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
);

CREATE POLICY "Admins can manage articles for their scope"
ON public.platform_articles FOR ALL TO authenticated
USING (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
)
WITH CHECK (
  (company_id IS NULL AND is_platform_admin(auth.uid()))
  OR (company_id = get_user_company_id() AND is_platform_or_company_admin(auth.uid()))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_config_company ON public.payment_config(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_company ON public.bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_company ON public.subscription_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_settings_company ON public.affiliate_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_ad_gate_settings_company ON public.ad_gate_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_system_notifications_company ON public.system_notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notification_automations_company ON public.notification_automations(company_id);
CREATE INDEX IF NOT EXISTS idx_platform_settings_company ON public.platform_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_platform_articles_company ON public.platform_articles(company_id);
