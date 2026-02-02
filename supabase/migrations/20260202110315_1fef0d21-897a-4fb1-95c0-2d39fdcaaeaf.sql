
-- Drop and recreate the function to include max redemption settings
DROP FUNCTION IF EXISTS lookup_customer_points_public(text, uuid);

CREATE OR REPLACE FUNCTION lookup_customer_points_public(_phone text, _tenant_id uuid)
RETURNS TABLE (
  current_points integer,
  total_points_earned integer,
  total_points_used integer,
  membership_tier text,
  point_value numeric,
  redeem_points integer,
  is_points_enabled boolean,
  max_redemption_enabled boolean,
  max_redemption_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.current_points,
    c.total_points_earned,
    c.total_points_used,
    c.membership_tier::text,
    COALESCE(ps.point_value, 1000)::numeric,
    COALESCE(ps.redeem_points, 1)::integer,
    COALESCE(ps.is_enabled, false),
    COALESCE(ps.max_redemption_enabled, false),
    COALESCE(ps.max_redemption_amount, 0)::numeric
  FROM customers c
  LEFT JOIN point_settings ps ON ps.tenant_id = c.tenant_id
  WHERE c.tenant_id = _tenant_id
    AND c.phone = _phone
  LIMIT 1;
END;
$$;
