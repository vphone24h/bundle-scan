-- =============================================
-- FIX REMAINING SECURITY VULNERABILITIES (v3)
-- =============================================

-- 1. FIX tenants table - Remove ALL public policies
DROP POLICY IF EXISTS "Public can view tenants for subdomain" ON public.tenants;
DROP POLICY IF EXISTS "Anyone can check subdomain" ON public.tenants;
DROP POLICY IF EXISTS "Public read for subdomain check" ON public.tenants;

-- 2. FIX branches - Remove public policy, keep only authenticated
DROP POLICY IF EXISTS "Public can view branches for landing" ON public.branches;
DROP POLICY IF EXISTS "Anyone can view branches" ON public.branches;

-- 3. FIX membership_tier_settings - Only tenant users can view
ALTER TABLE public.membership_tier_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view membership tiers" ON public.membership_tier_settings;
DROP POLICY IF EXISTS "Anyone can view tiers" ON public.membership_tier_settings;

CREATE POLICY "Tenant users can view membership tiers"
ON public.membership_tier_settings FOR SELECT
TO authenticated
USING (
  tenant_id = (
    SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid() LIMIT 1
  )
);

-- 4. FIX point_settings - Only tenant users can view
ALTER TABLE public.point_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view point settings" ON public.point_settings;
DROP POLICY IF EXISTS "Anyone can view point settings" ON public.point_settings;

CREATE POLICY "Tenant users can view point settings"
ON public.point_settings FOR SELECT
TO authenticated
USING (
  tenant_id = (
    SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid() LIMIT 1
  )
);

-- 5. UPDATE advertisements - Hide analytics from public
DROP POLICY IF EXISTS "View advertisements" ON public.advertisements;

-- Create a secure view for public ads without analytics
CREATE OR REPLACE VIEW public.advertisements_public 
WITH (security_invoker = on) AS
SELECT 
  id, 
  title, 
  description, 
  image_url, 
  link_url, 
  ad_type, 
  display_order,
  start_date,
  end_date,
  is_active,
  tenant_id
FROM public.advertisements
WHERE is_active = true 
  AND (start_date IS NULL OR start_date <= now())
  AND (end_date IS NULL OR end_date >= now());

-- Ads table only accessible to authenticated users
CREATE POLICY "Ads accessible to authenticated users"
ON public.advertisements FOR SELECT
TO authenticated
USING (
  tenant_id IS NULL -- Platform ads
  OR tenant_id IN (
    SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()
  )
);

-- Allow anon to view only active ads (for landing pages)
CREATE POLICY "Public can view active ads only"
ON public.advertisements FOR SELECT
TO anon
USING (
  is_active = true 
  AND (start_date IS NULL OR start_date <= now())
  AND (end_date IS NULL OR end_date >= now())
  AND tenant_id IS NULL -- Only platform-level ads for anon
);