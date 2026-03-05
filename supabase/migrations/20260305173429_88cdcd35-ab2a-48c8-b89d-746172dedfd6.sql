
CREATE OR REPLACE FUNCTION public.get_customer_stats(
  _branch_id uuid DEFAULT NULL,
  _tier text DEFAULT NULL,
  _crm_status text DEFAULT NULL,
  _staff_id uuid DEFAULT NULL,
  _tag_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
  _total integer;
  _with_points integer;
  _vip integer;
  _purchased integer;
BEGIN
  _tenant_id := public.get_user_tenant_id_secure();
  IF _tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'totalCustomers', 0,
      'customersWithPoints', 0,
      'vipCustomers', 0,
      'customersWithPurchase', 0
    );
  END IF;

  -- Build filtered counts using a CTE for the base filter
  WITH filtered AS (
    SELECT c.id, c.current_points, c.membership_tier, c.total_spent
    FROM public.customers c
    WHERE c.tenant_id = _tenant_id
      AND (_branch_id IS NULL OR c.preferred_branch_id = _branch_id)
      AND (_tier IS NULL OR c.membership_tier::text = _tier)
      AND (_crm_status IS NULL OR c.crm_status::text = _crm_status)
      AND (_staff_id IS NULL OR c.assigned_staff_id = _staff_id)
      AND (_tag_id IS NULL OR EXISTS (
        SELECT 1 FROM public.customer_tag_assignments cta
        WHERE cta.customer_id = c.id AND cta.tag_id = _tag_id
      ))
  )
  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE current_points > 0)::integer,
    COUNT(*) FILTER (WHERE membership_tier = 'vip')::integer,
    COUNT(*) FILTER (WHERE total_spent > 0)::integer
  INTO _total, _with_points, _vip, _purchased
  FROM filtered;

  RETURN jsonb_build_object(
    'totalCustomers', _total,
    'customersWithPoints', _with_points,
    'vipCustomers', _vip,
    'customersWithPurchase', _purchased
  );
END;
$$;
