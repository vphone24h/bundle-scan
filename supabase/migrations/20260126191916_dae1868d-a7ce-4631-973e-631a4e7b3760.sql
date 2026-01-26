-- Enum cho trạng thái affiliate
CREATE TYPE public.affiliate_status AS ENUM ('pending', 'active', 'blocked');

-- Enum cho trạng thái hoa hồng
CREATE TYPE public.commission_status AS ENUM ('pending', 'approved', 'paid', 'cancelled');

-- Enum cho trạng thái yêu cầu rút tiền
CREATE TYPE public.withdrawal_status AS ENUM ('pending', 'approved', 'paid', 'rejected');

-- Enum cho kiểu tính hoa hồng
CREATE TYPE public.commission_type AS ENUM ('percentage', 'fixed');

-- Bảng cấu hình affiliate (global)
CREATE TABLE public.affiliate_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT false,
  -- Điều kiện để trở thành affiliate
  min_subscription_months integer NOT NULL DEFAULT 3,
  require_approval boolean NOT NULL DEFAULT false,
  -- Chống gian lận
  check_same_email boolean NOT NULL DEFAULT true,
  check_same_phone boolean NOT NULL DEFAULT true,
  check_same_ip boolean NOT NULL DEFAULT false,
  -- Thời gian treo thưởng (ngày)
  hold_days integer NOT NULL DEFAULT 7,
  -- Số tiền tối thiểu để rút
  min_withdrawal_amount numeric NOT NULL DEFAULT 500000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Bảng cấu hình hoa hồng theo gói
CREATE TABLE public.affiliate_commission_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE CASCADE NOT NULL,
  commission_type commission_type NOT NULL DEFAULT 'percentage',
  commission_value numeric NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id)
);

-- Bảng affiliate (người giới thiệu)
CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  affiliate_code text NOT NULL UNIQUE,
  status affiliate_status NOT NULL DEFAULT 'pending',
  -- Thông tin ngân hàng
  bank_name text,
  bank_account_number text,
  bank_account_holder text,
  -- Thống kê
  total_clicks integer NOT NULL DEFAULT 0,
  total_referrals integer NOT NULL DEFAULT 0,
  total_conversions integer NOT NULL DEFAULT 0,
  total_commission_earned numeric NOT NULL DEFAULT 0,
  total_commission_paid numeric NOT NULL DEFAULT 0,
  available_balance numeric NOT NULL DEFAULT 0,
  pending_balance numeric NOT NULL DEFAULT 0,
  -- Tracking
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  blocked_at timestamptz,
  blocked_reason text
);

-- Bảng theo dõi click link affiliate
CREATE TABLE public.affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE NOT NULL,
  ip_address text,
  user_agent text,
  referrer_url text,
  landing_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Bảng referral (người được giới thiệu)
CREATE TABLE public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE NOT NULL,
  referred_tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  referred_user_id uuid NOT NULL,
  referred_email text,
  referred_phone text,
  ip_address text,
  status text NOT NULL DEFAULT 'registered',
  registered_at timestamptz NOT NULL DEFAULT now(),
  converted_at timestamptz,
  UNIQUE(referred_tenant_id)
);

-- Bảng hoa hồng
CREATE TABLE public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE NOT NULL,
  referral_id uuid REFERENCES public.affiliate_referrals(id) ON DELETE CASCADE NOT NULL,
  payment_request_id uuid REFERENCES public.payment_requests(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  -- Số tiền
  order_amount numeric NOT NULL,
  commission_type commission_type NOT NULL,
  commission_rate numeric NOT NULL,
  commission_amount numeric NOT NULL,
  -- Trạng thái
  status commission_status NOT NULL DEFAULT 'pending',
  hold_until timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Bảng yêu cầu rút tiền
CREATE TABLE public.affiliate_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  -- Thông tin thanh toán
  bank_name text NOT NULL,
  bank_account_number text NOT NULL,
  bank_account_holder text NOT NULL,
  -- Trạng thái
  status withdrawal_status NOT NULL DEFAULT 'pending',
  note text,
  -- Admin xử lý
  processed_at timestamptz,
  processed_by uuid,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS Policies cho affiliate_settings
CREATE POLICY "Platform admins can manage affiliate settings"
  ON public.affiliate_settings FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Authenticated users can view affiliate settings"
  ON public.affiliate_settings FOR SELECT
  USING (is_authenticated());

-- RLS Policies cho affiliate_commission_rates
CREATE POLICY "Platform admins can manage commission rates"
  ON public.affiliate_commission_rates FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Authenticated users can view commission rates"
  ON public.affiliate_commission_rates FOR SELECT
  USING (is_authenticated());

-- RLS Policies cho affiliates
CREATE POLICY "Platform admins can manage all affiliates"
  ON public.affiliates FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can view own affiliate"
  ON public.affiliates FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own affiliate"
  ON public.affiliates FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Tenant users can create affiliate"
  ON public.affiliates FOR INSERT
  WITH CHECK (belongs_to_tenant(auth.uid(), tenant_id));

-- RLS Policies cho affiliate_clicks
CREATE POLICY "Platform admins can view all clicks"
  ON public.affiliate_clicks FOR SELECT
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Anyone can insert clicks"
  ON public.affiliate_clicks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Affiliates can view own clicks"
  ON public.affiliate_clicks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.affiliates a 
      WHERE a.id = affiliate_id AND a.user_id = auth.uid()
    )
  );

-- RLS Policies cho affiliate_referrals
CREATE POLICY "Platform admins can manage all referrals"
  ON public.affiliate_referrals FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Affiliates can view own referrals"
  ON public.affiliate_referrals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.affiliates a 
      WHERE a.id = affiliate_id AND a.user_id = auth.uid()
    )
  );

-- RLS Policies cho affiliate_commissions
CREATE POLICY "Platform admins can manage all commissions"
  ON public.affiliate_commissions FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Affiliates can view own commissions"
  ON public.affiliate_commissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.affiliates a 
      WHERE a.id = affiliate_id AND a.user_id = auth.uid()
    )
  );

-- RLS Policies cho affiliate_withdrawals
CREATE POLICY "Platform admins can manage all withdrawals"
  ON public.affiliate_withdrawals FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Affiliates can view own withdrawals"
  ON public.affiliate_withdrawals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.affiliates a 
      WHERE a.id = affiliate_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "Affiliates can create own withdrawals"
  ON public.affiliate_withdrawals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.affiliates a 
      WHERE a.id = affiliate_id AND a.user_id = auth.uid()
    )
  );

-- Insert default settings
INSERT INTO public.affiliate_settings (
  is_enabled, min_subscription_months, require_approval,
  check_same_email, check_same_phone, check_same_ip,
  hold_days, min_withdrawal_amount
) VALUES (
  false, 3, false,
  true, true, true,
  7, 500000
);

-- Trigger cập nhật updated_at
CREATE TRIGGER update_affiliate_settings_updated_at
  BEFORE UPDATE ON public.affiliate_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliate_commission_rates_updated_at
  BEFORE UPDATE ON public.affiliate_commission_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliates_updated_at
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliate_commissions_updated_at
  BEFORE UPDATE ON public.affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliate_withdrawals_updated_at
  BEFORE UPDATE ON public.affiliate_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function tạo mã affiliate ngẫu nhiên
CREATE OR REPLACE FUNCTION public.generate_affiliate_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Function kiểm tra điều kiện trở thành affiliate
CREATE OR REPLACE FUNCTION public.can_become_affiliate(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants t
    CROSS JOIN public.affiliate_settings s
    WHERE t.id = _tenant_id
    AND t.status = 'active'
    AND (
      t.subscription_start_date IS NOT NULL
      AND t.subscription_start_date <= now() - (s.min_subscription_months || ' months')::interval
    )
  )
$$;