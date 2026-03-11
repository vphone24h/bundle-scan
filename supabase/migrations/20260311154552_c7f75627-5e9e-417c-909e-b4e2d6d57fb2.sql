
CREATE OR REPLACE FUNCTION public.get_automation_eligible_tenants(
  p_target_audience text,
  p_trigger_type text,
  p_trigger_days int
)
RETURNS TABLE(
  tenant_id uuid,
  tenant_name text,
  subdomain text,
  status text,
  created_at timestamptz,
  trial_end_date timestamptz,
  subscription_end_date timestamptz,
  subscription_plan text,
  admin_email text,
  last_sign_in_at timestamptz,
  days_since_creation int,
  days_since_login int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    t.subdomain,
    t.status::text,
    t.created_at,
    t.trial_end_date,
    t.subscription_end_date,
    t.subscription_plan,
    COALESCE(pu.email, au.email) as admin_email,
    au.last_sign_in_at,
    EXTRACT(DAY FROM NOW() - t.created_at)::int as days_since_creation,
    CASE WHEN au.last_sign_in_at IS NOT NULL 
      THEN EXTRACT(DAY FROM NOW() - au.last_sign_in_at)::int
      ELSE EXTRACT(DAY FROM NOW() - t.created_at)::int
    END as days_since_login
  FROM tenants t
  JOIN platform_users pu ON pu.tenant_id = t.id AND pu.platform_role = 'tenant_admin'
  JOIN auth.users au ON au.id = pu.user_id
  WHERE 
    COALESCE(pu.email, au.email) IS NOT NULL
    AND (
      (p_target_audience = 'active' AND t.status = 'active') OR
      (p_target_audience = 'trial' AND t.status = 'trial') OR
      (p_target_audience = 'free' AND t.status = 'expired') OR
      (p_target_audience = 'paid' AND t.status IN ('active','trial') AND t.subscription_plan IS NOT NULL) OR
      (p_target_audience = 'all' AND t.status IN ('active','trial','expired')) OR
      (p_target_audience NOT IN ('active','trial','free','paid','all') AND t.status IN ('active','trial','expired'))
    );
$$;
