
-- ============================================
-- Shop-level CTV (Collaborator) System
-- ============================================

-- 1. CTV accounts table (per tenant)
CREATE TABLE public.shop_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ctv_code text NOT NULL,
  full_name text NOT NULL,
  phone text,
  email text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'pending')),
  commission_rate numeric NOT NULL DEFAULT 0,
  commission_type text NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  total_orders integer NOT NULL DEFAULT 0,
  total_revenue numeric NOT NULL DEFAULT 0,
  total_commission numeric NOT NULL DEFAULT 0,
  available_balance numeric NOT NULL DEFAULT 0,
  pending_balance numeric NOT NULL DEFAULT 0,
  paid_balance numeric NOT NULL DEFAULT 0,
  bank_name text,
  bank_account_number text,
  bank_account_holder text,
  referrer_id uuid REFERENCES public.shop_collaborators(id),
  blocked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, ctv_code),
  UNIQUE(tenant_id, email)
);

-- 2. CTV orders tracking (link orders to CTV)
CREATE TABLE public.shop_ctv_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ctv_id uuid NOT NULL REFERENCES public.shop_collaborators(id) ON DELETE CASCADE,
  order_id uuid,
  landing_order_id uuid REFERENCES public.landing_orders(id),
  order_code text,
  customer_name text,
  customer_phone text,
  order_amount numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 0,
  commission_type text NOT NULL DEFAULT 'percentage',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  source text NOT NULL DEFAULT 'link' CHECK (source IN ('link', 'code')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. CTV withdrawal requests
CREATE TABLE public.shop_ctv_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ctv_id uuid NOT NULL REFERENCES public.shop_collaborators(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  bank_name text NOT NULL,
  bank_account_number text NOT NULL,
  bank_account_holder text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  processed_at timestamptz,
  processed_by uuid,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Shop CTV settings (per tenant)
CREATE TABLE public.shop_ctv_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  is_enabled boolean NOT NULL DEFAULT false,
  default_commission_rate numeric NOT NULL DEFAULT 5,
  default_commission_type text NOT NULL DEFAULT 'percentage',
  cookie_tracking_days integer NOT NULL DEFAULT 30,
  min_withdrawal_amount numeric NOT NULL DEFAULT 200000,
  allow_self_register boolean NOT NULL DEFAULT true,
  auto_approve_ctv boolean NOT NULL DEFAULT true,
  program_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add ctv tracking columns to landing_orders
ALTER TABLE public.landing_orders ADD COLUMN IF NOT EXISTS ctv_id uuid REFERENCES public.shop_collaborators(id);
ALTER TABLE public.landing_orders ADD COLUMN IF NOT EXISTS ctv_code text;

-- RLS
ALTER TABLE public.shop_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_ctv_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_ctv_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_ctv_settings ENABLE ROW LEVEL SECURITY;

-- shop_collaborators policies
CREATE POLICY "CTV can view own record" ON public.shop_collaborators
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Tenant admins manage CTVs" ON public.shop_collaborators
  FOR ALL TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

-- Allow anon to insert (self-register CTV from landing page via RPC)
-- We'll use RPC for registration instead of direct insert

-- shop_ctv_orders policies
CREATE POLICY "CTV view own orders" ON public.shop_ctv_orders
  FOR SELECT TO authenticated
  USING (ctv_id IN (SELECT id FROM public.shop_collaborators WHERE user_id = auth.uid()));

CREATE POLICY "Tenant admins manage CTV orders" ON public.shop_ctv_orders
  FOR ALL TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

-- shop_ctv_withdrawals policies
CREATE POLICY "CTV view own withdrawals" ON public.shop_ctv_withdrawals
  FOR SELECT TO authenticated
  USING (ctv_id IN (SELECT id FROM public.shop_collaborators WHERE user_id = auth.uid()));

CREATE POLICY "CTV create withdrawal" ON public.shop_ctv_withdrawals
  FOR INSERT TO authenticated
  WITH CHECK (ctv_id IN (SELECT id FROM public.shop_collaborators WHERE user_id = auth.uid()));

CREATE POLICY "Tenant admins manage withdrawals" ON public.shop_ctv_withdrawals
  FOR ALL TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

-- shop_ctv_settings policies
CREATE POLICY "Anyone can read enabled settings" ON public.shop_ctv_settings
  FOR SELECT USING (true);

CREATE POLICY "Tenant admins manage settings" ON public.shop_ctv_settings
  FOR ALL TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

-- RPC: Generate unique CTV code for a tenant
CREATE OR REPLACE FUNCTION public.generate_shop_ctv_code(_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text;
  i integer;
BEGIN
  LOOP
    result := 'CTV';
    FOR i IN 1..5 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.shop_collaborators WHERE tenant_id = _tenant_id AND ctv_code = result
    );
  END LOOP;
  RETURN result;
END;
$$;

-- RPC: Register CTV (called from landing page after user signs up)
CREATE OR REPLACE FUNCTION public.register_shop_ctv(
  _tenant_id uuid,
  _full_name text,
  _email text,
  _phone text DEFAULT NULL,
  _referrer_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _settings RECORD;
  _referrer_id uuid;
  _ctv_code text;
  _ctv_id uuid;
  _status text;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Get settings
  SELECT * INTO _settings FROM public.shop_ctv_settings WHERE tenant_id = _tenant_id;
  IF NOT FOUND OR NOT _settings.is_enabled THEN
    RAISE EXCEPTION 'CTV program is not enabled for this store';
  END IF;

  -- Check if already registered
  IF EXISTS (SELECT 1 FROM public.shop_collaborators WHERE tenant_id = _tenant_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Already registered as CTV';
  END IF;

  -- Find referrer
  IF _referrer_code IS NOT NULL AND _referrer_code != '' THEN
    SELECT id INTO _referrer_id FROM public.shop_collaborators
    WHERE tenant_id = _tenant_id AND ctv_code = _referrer_code AND status = 'active';
  END IF;

  _ctv_code := public.generate_shop_ctv_code(_tenant_id);
  _status := CASE WHEN _settings.auto_approve_ctv THEN 'active' ELSE 'pending' END;

  INSERT INTO public.shop_collaborators (
    tenant_id, user_id, ctv_code, full_name, phone, email,
    status, commission_rate, commission_type, referrer_id
  ) VALUES (
    _tenant_id, _user_id, _ctv_code, _full_name, _phone, _email,
    _status, _settings.default_commission_rate, _settings.default_commission_type, _referrer_id
  )
  RETURNING id INTO _ctv_id;

  RETURN jsonb_build_object(
    'ctv_id', _ctv_id,
    'ctv_code', _ctv_code,
    'status', _status
  );
END;
$$;

-- RPC: Get CTV dashboard data
CREATE OR REPLACE FUNCTION public.get_my_shop_ctv(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _ctv RECORD;
  _result jsonb;
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
    'created_at', _ctv.created_at
  );
END;
$$;
