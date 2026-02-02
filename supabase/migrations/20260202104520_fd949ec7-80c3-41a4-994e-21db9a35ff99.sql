-- Create RPC function to lookup customer points and point settings for public landing page
-- This function only returns non-sensitive information
CREATE OR REPLACE FUNCTION public.lookup_customer_points_public(
  _phone text,
  _tenant_id uuid
)
RETURNS TABLE (
  current_points integer,
  total_points_earned integer,
  total_points_used integer,
  membership_tier text,
  point_value numeric,
  redeem_points integer,
  is_points_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.current_points,
    c.total_points_earned,
    c.total_points_used,
    c.membership_tier::text,
    ps.redeem_value,
    ps.redeem_points,
    COALESCE(ps.is_enabled, false)
  FROM customers c
  LEFT JOIN point_settings ps ON ps.tenant_id = c.tenant_id
  WHERE c.phone = _phone
    AND c.tenant_id = _tenant_id
  LIMIT 1;
$$;