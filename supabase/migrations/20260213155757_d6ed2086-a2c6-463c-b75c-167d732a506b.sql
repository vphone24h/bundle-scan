
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can read staff_reviews for duplicate check" ON public.staff_reviews;
DROP POLICY IF EXISTS "Anyone can insert staff_reviews" ON public.staff_reviews;

-- Policy "Tenant members can read staff_reviews" already exists, skip creation

-- Create secure RPC for duplicate check (anon-safe, returns minimal data)
CREATE OR REPLACE FUNCTION public.check_review_exists(
  _export_receipt_item_id uuid,
  _tenant_id uuid
)
RETURNS TABLE(exists_flag boolean, rating integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT true, sr.rating::integer
  FROM staff_reviews sr
  WHERE sr.export_receipt_item_id = _export_receipt_item_id
    AND sr.tenant_id = _tenant_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.check_review_exists(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.check_review_exists(uuid, uuid) TO authenticated;

-- Create secure RPC for submitting review with full validation + points
CREATE OR REPLACE FUNCTION public.submit_staff_review(
  _tenant_id uuid,
  _branch_id uuid,
  _staff_user_id uuid,
  _customer_name text,
  _customer_phone text,
  _rating integer,
  _content text,
  _export_receipt_item_id uuid,
  _customer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _review_id uuid;
  _points_added integer := 0;
  _new_balance integer := 0;
BEGIN
  IF _rating < 1 OR _rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  -- Validate export_receipt_item exists and belongs to tenant
  IF NOT EXISTS (
    SELECT 1 FROM export_receipt_items eri
    JOIN export_receipts er ON er.id = eri.receipt_id
    WHERE eri.id = _export_receipt_item_id
      AND er.tenant_id = _tenant_id
  ) THEN
    RAISE EXCEPTION 'Invalid export receipt item';
  END IF;

  -- Validate staff belongs to tenant
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _staff_user_id
      AND tenant_id = _tenant_id
  ) THEN
    RAISE EXCEPTION 'Invalid staff user';
  END IF;

  -- Check duplicate
  IF EXISTS (
    SELECT 1 FROM staff_reviews
    WHERE export_receipt_item_id = _export_receipt_item_id
      AND tenant_id = _tenant_id
  ) THEN
    RAISE EXCEPTION 'Review already exists for this item';
  END IF;

  INSERT INTO staff_reviews (
    tenant_id, branch_id, staff_user_id,
    customer_name, customer_phone, rating, content,
    export_receipt_item_id
  ) VALUES (
    _tenant_id, _branch_id, _staff_user_id,
    NULLIF(TRIM(_customer_name), ''), NULLIF(TRIM(_customer_phone), ''),
    _rating, NULLIF(TRIM(_content), ''),
    _export_receipt_item_id
  )
  RETURNING id INTO _review_id;

  -- Award points if customer exists
  IF _customer_id IS NOT NULL THEN
    SELECT pt.points_added, pt.new_balance
    INTO _points_added, _new_balance
    FROM public.add_review_reward_points(_customer_id, _tenant_id, _review_id) pt;
  END IF;

  RETURN jsonb_build_object(
    'review_id', _review_id,
    'points_added', COALESCE(_points_added, 0),
    'new_balance', COALESCE(_new_balance, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_staff_review(uuid, uuid, uuid, text, text, integer, text, uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_staff_review(uuid, uuid, uuid, text, text, integer, text, uuid, uuid) TO authenticated;

-- Revoke anon access to add_review_reward_points (now called internally by submit_staff_review)
REVOKE EXECUTE ON FUNCTION public.add_review_reward_points(uuid, uuid, uuid) FROM anon;
