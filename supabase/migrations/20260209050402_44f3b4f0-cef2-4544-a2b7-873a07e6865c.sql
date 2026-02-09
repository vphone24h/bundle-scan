
-- Drop existing functions that need return type changes
DROP FUNCTION IF EXISTS public.lookup_warranty_by_phone(text, uuid);
DROP FUNCTION IF EXISTS public.lookup_warranty_by_imei(text, uuid);
DROP FUNCTION IF EXISTS public.lookup_customer_points_public(text, uuid);

-- 1. Add review_reward_points to point_settings
ALTER TABLE public.point_settings 
ADD COLUMN IF NOT EXISTS review_reward_points integer NOT NULL DEFAULT 0;

-- 2. Recreate lookup_warranty_by_phone with customer_name and customer_id
CREATE FUNCTION public.lookup_warranty_by_phone(_phone text, _tenant_id uuid)
RETURNS TABLE(
  id uuid,
  imei text,
  product_name text,
  sku text,
  warranty text,
  sale_price numeric,
  created_at timestamptz,
  branch_name text,
  export_date date,
  staff_user_id uuid,
  staff_name text,
  branch_id uuid,
  customer_name text,
  customer_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    eri.id,
    eri.imei,
    eri.product_name,
    eri.sku,
    eri.warranty,
    eri.sale_price,
    eri.created_at,
    b.name AS branch_name,
    er.export_date,
    er.created_by AS staff_user_id,
    p.display_name AS staff_name,
    er.branch_id,
    c.name AS customer_name,
    c.id AS customer_id
  FROM export_receipt_items eri
  INNER JOIN export_receipts er ON er.id = eri.receipt_id
  LEFT JOIN branches b ON b.id = er.branch_id
  LEFT JOIN profiles p ON p.user_id = er.created_by
  INNER JOIN customers c ON c.id = er.customer_id
  WHERE c.phone = _phone
    AND c.tenant_id = _tenant_id
    AND er.tenant_id = _tenant_id
    AND eri.status = 'sold'
  ORDER BY eri.created_at DESC
  LIMIT 20
$$;

-- 3. Recreate lookup_warranty_by_imei with customer_name and customer_id
CREATE FUNCTION public.lookup_warranty_by_imei(_imei text, _tenant_id uuid)
RETURNS TABLE(
  id uuid,
  imei text,
  product_name text,
  sku text,
  warranty text,
  sale_price numeric,
  created_at timestamptz,
  branch_name text,
  export_date date,
  staff_user_id uuid,
  staff_name text,
  branch_id uuid,
  customer_name text,
  customer_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    eri.id,
    eri.imei,
    eri.product_name,
    eri.sku,
    eri.warranty,
    eri.sale_price,
    eri.created_at,
    b.name AS branch_name,
    er.export_date,
    er.created_by AS staff_user_id,
    p.display_name AS staff_name,
    er.branch_id,
    c.name AS customer_name,
    c.id AS customer_id
  FROM export_receipt_items eri
  INNER JOIN export_receipts er ON er.id = eri.receipt_id
  LEFT JOIN branches b ON b.id = er.branch_id
  LEFT JOIN profiles p ON p.user_id = er.created_by
  INNER JOIN customers c ON c.id = er.customer_id
  WHERE eri.imei = _imei
    AND er.tenant_id = _tenant_id
    AND eri.status = 'sold'
  ORDER BY eri.created_at DESC
  LIMIT 5
$$;

-- 4. Create RPC to add review reward points (anon-callable, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.add_review_reward_points(
  _customer_id uuid,
  _tenant_id uuid,
  _review_id uuid
)
RETURNS TABLE(points_added integer, new_balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _reward_points integer;
  _current_points integer;
  _new_balance integer;
  _is_enabled boolean;
BEGIN
  -- Get review reward points from point_settings
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

  -- If points system disabled or no reward configured, return 0
  IF NOT COALESCE(_is_enabled, false) OR COALESCE(_reward_points, 0) <= 0 THEN
    RETURN QUERY SELECT 0::integer, 0::integer;
    RETURN;
  END IF;

  -- Check customer exists and belongs to tenant
  SELECT c.current_points INTO _current_points
  FROM customers c
  WHERE c.id = _customer_id AND c.tenant_id = _tenant_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::integer, 0::integer;
    RETURN;
  END IF;

  _new_balance := COALESCE(_current_points, 0) + _reward_points;

  -- Create point transaction
  INSERT INTO point_transactions (
    customer_id, transaction_type, points, balance_after, 
    status, description, reference_type, reference_id
  ) VALUES (
    _customer_id, 'earn', _reward_points, _new_balance,
    'active', 'Thưởng điểm đánh giá nhân viên', 'staff_review', _review_id::text
  );

  -- Update customer points
  UPDATE customers
  SET current_points = _new_balance,
      total_points_earned = total_points_earned + _reward_points,
      updated_at = now()
  WHERE id = _customer_id;

  RETURN QUERY SELECT _reward_points, _new_balance;
END;
$$;

-- Grant execute to anon for the reward function
GRANT EXECUTE ON FUNCTION public.add_review_reward_points(uuid, uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.add_review_reward_points(uuid, uuid, uuid) TO authenticated;

-- 5. Recreate lookup_customer_points_public with review_reward_points
CREATE FUNCTION public.lookup_customer_points_public(_phone text, _tenant_id uuid)
RETURNS TABLE(
  current_points integer,
  total_points_earned integer,
  total_points_used integer,
  membership_tier text,
  point_value numeric,
  redeem_points integer,
  is_points_enabled boolean,
  max_redemption_enabled boolean,
  max_redemption_amount numeric,
  review_reward_points integer,
  customer_name text,
  customer_id uuid
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
    COALESCE(ps.redeem_value, 1000)::numeric,
    COALESCE(ps.redeem_points, 1)::integer,
    COALESCE(ps.is_enabled, false),
    COALESCE(ps.use_max_amount_limit, false),
    COALESCE(ps.max_redeem_amount, 0)::numeric,
    COALESCE(ps.review_reward_points, 0)::integer,
    c.name,
    c.id
  FROM customers c
  LEFT JOIN point_settings ps ON ps.tenant_id = c.tenant_id
  WHERE c.tenant_id = _tenant_id
    AND c.phone = _phone
  LIMIT 1;
END;
$$;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION public.lookup_warranty_by_phone(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_warranty_by_phone(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_warranty_by_imei(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_warranty_by_imei(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_customer_points_public(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_customer_points_public(text, uuid) TO authenticated;
