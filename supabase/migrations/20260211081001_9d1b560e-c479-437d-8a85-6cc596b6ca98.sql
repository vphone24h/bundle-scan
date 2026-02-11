CREATE OR REPLACE FUNCTION public.add_review_reward_points(_customer_id uuid, _tenant_id uuid, _review_id uuid)
 RETURNS TABLE(points_added integer, new_balance integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _reward_points integer;
  _current_points integer;
  _new_balance integer;
  _is_enabled boolean;
BEGIN
  -- Check if points already awarded for this review
  IF EXISTS(
    SELECT 1 FROM point_transactions 
    WHERE reference_type = 'staff_review' AND reference_id = _review_id
  ) THEN
    RETURN QUERY SELECT 0::integer, 0::integer;
    RETURN;
  END IF;

  -- Get review reward points from point_settings (tenant-specific first)
  SELECT ps.review_reward_points, ps.is_enabled
  INTO _reward_points, _is_enabled
  FROM point_settings ps
  WHERE ps.tenant_id = _tenant_id
  LIMIT 1;

  -- If no tenant settings, try global
  IF _reward_points IS NULL THEN
    SELECT ps.review_reward_points, ps.is_enabled
    INTO _reward_points, _is_enabled
    FROM point_settings ps
    WHERE ps.tenant_id IS NULL
    LIMIT 1;
  END IF;

  IF NOT COALESCE(_is_enabled, false) OR COALESCE(_reward_points, 0) <= 0 THEN
    RETURN QUERY SELECT 0::integer, 0::integer;
    RETURN;
  END IF;

  SELECT c.current_points INTO _current_points
  FROM customers c
  WHERE c.id = _customer_id AND c.tenant_id = _tenant_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::integer, 0::integer;
    RETURN;
  END IF;

  _new_balance := COALESCE(_current_points, 0) + _reward_points;

  INSERT INTO point_transactions (
    customer_id, transaction_type, points, balance_after, 
    status, description, reference_type, reference_id
  ) VALUES (
    _customer_id, 'earn', _reward_points, _new_balance,
    'active', 'Thưởng điểm đánh giá nhân viên', 'staff_review', _review_id
  );

  UPDATE customers
  SET current_points = _new_balance,
      total_points_earned = total_points_earned + _reward_points,
      updated_at = now()
  WHERE id = _customer_id;

  RETURN QUERY SELECT _reward_points, _new_balance;
END;
$function$;