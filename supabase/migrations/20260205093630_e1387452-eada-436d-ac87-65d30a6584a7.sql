-- Update RLS policies to allow reading global articles (tenant_id = null)
DROP POLICY IF EXISTS "Users can view tax articles of their tenant" ON public.tax_policy_articles;
DROP POLICY IF EXISTS "Admins can manage tax articles" ON public.tax_policy_articles;

-- Allow all authenticated users to read global articles
CREATE POLICY "Anyone can view global tax articles"
ON public.tax_policy_articles
FOR SELECT
USING (tenant_id IS NULL);

-- Allow platform admins to manage global articles
CREATE POLICY "Platform admins can manage tax articles"
ON public.tax_policy_articles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = auth.uid()
    AND platform_role = 'platform_admin'
  )
);