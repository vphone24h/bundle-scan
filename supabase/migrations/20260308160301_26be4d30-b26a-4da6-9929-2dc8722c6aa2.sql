
-- Update get_my_shop_ctv to also include referrer_id
CREATE OR REPLACE FUNCTION public.get_my_shop_ctv(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _ctv RECORD;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _ctv FROM public.shop_collaborators
  WHERE tenant_id = _tenant_id AND user_id = _user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', _ctv.id,
    'ctv_code', _ctv.ctv_code,
    'full_name', _ctv.full_name,
    'phone', _ctv.phone,
    'email', _ctv.email,
    'status', _ctv.status,
    'commission_rate', _ctv.commission_rate,
    'commission_type', _ctv.commission_type,
    'total_orders', _ctv.total_orders,
    'total_revenue', _ctv.total_revenue,
    'total_commission', _ctv.total_commission,
    'available_balance', _ctv.available_balance,
    'pending_balance', _ctv.pending_balance,
    'paid_balance', _ctv.paid_balance,
    'bank_name', _ctv.bank_name,
    'bank_account_number', _ctv.bank_account_number,
    'bank_account_holder', _ctv.bank_account_holder,
    'referrer_id', _ctv.referrer_id,
    'created_at', _ctv.created_at
  );
END;
$$;

-- RPC: Get referred CTVs (F1) with their stats
CREATE OR REPLACE FUNCTION public.get_my_referred_ctvs(_ctv_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _result jsonb;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Verify the CTV belongs to current user
  IF NOT EXISTS (SELECT 1 FROM public.shop_collaborators WHERE id = _ctv_id AND user_id = _user_id) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(sub) ORDER BY sub.created_at DESC), '[]'::jsonb)
  INTO _result
  FROM (
    SELECT 
      sc.id,
      sc.ctv_code,
      sc.full_name,
      sc.phone,
      sc.status,
      sc.total_orders,
      sc.total_revenue,
      sc.total_commission,
      sc.created_at
    FROM public.shop_collaborators sc
    WHERE sc.referrer_id = _ctv_id
  ) sub;

  RETURN _result;
END;
$$;
