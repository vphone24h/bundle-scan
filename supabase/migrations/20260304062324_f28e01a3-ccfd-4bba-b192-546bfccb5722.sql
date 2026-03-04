
CREATE OR REPLACE FUNCTION public.get_verified_user_ids(p_user_ids uuid[])
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT uid), '{}')
  FROM (
    SELECT pu.user_id AS uid
    FROM platform_users pu
    JOIN tenants t ON t.id = pu.tenant_id
    WHERE pu.user_id = ANY(p_user_ids)
      AND (
        t.subscription_plan = 'lifetime'
        OR (t.subscription_plan IS NOT NULL AND t.subscription_end_date > now())
      )
    UNION
    SELECT sp.user_id AS uid
    FROM social_profiles sp
    WHERE sp.user_id = ANY(p_user_ids)
      AND sp.is_verified = true
  ) sub;
$$;
