
CREATE OR REPLACE FUNCTION public.get_customer_stats(_branch_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
  _total integer;
  _with_points integer;
  _vip integer;
  _with_purchase integer;
BEGIN
  _tenant_id := public.get_user_tenant_id_secure();
  IF _tenant_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT 
    COUNT(*)::integer,
    COUNT(CASE WHEN current_points > 0 THEN 1 END)::integer,
    COUNT(CASE WHEN membership_tier = 'vip' THEN 1 END)::integer,
    COUNT(CASE WHEN total_spent > 0 THEN 1 END)::integer
  INTO _total, _with_points, _vip, _with_purchase
  FROM customers
  WHERE tenant_id = _tenant_id
    AND (_branch_id IS NULL OR preferred_branch_id = _branch_id);

  RETURN jsonb_build_object(
    'totalCustomers', _total,
    'customersWithPoints', _with_points,
    'vipCustomers', _vip,
    'customersWithPurchase', _with_purchase
  );
END;
$$;
