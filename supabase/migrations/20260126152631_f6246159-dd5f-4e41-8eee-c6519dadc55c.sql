-- ===========================================
-- CUSTOMER LOYALTY POINTS SYSTEM (FULL VERSION)
-- ===========================================

-- 1. Enum cho trạng thái điểm
CREATE TYPE public.point_status AS ENUM ('active', 'pending', 'expired');
CREATE TYPE public.point_transaction_type AS ENUM ('earn', 'redeem', 'refund', 'adjust', 'expire');
CREATE TYPE public.customer_status AS ENUM ('active', 'inactive');
CREATE TYPE public.membership_tier AS ENUM ('regular', 'silver', 'gold', 'vip');

-- 2. Thêm cột vào bảng customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS total_spent numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_points integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_points integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_points_earned integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_points_used integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS membership_tier membership_tier NOT NULL DEFAULT 'regular',
ADD COLUMN IF NOT EXISTS status customer_status NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS birthday date,
ADD COLUMN IF NOT EXISTS last_purchase_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS preferred_branch_id uuid REFERENCES public.branches(id);

-- 3. Bảng lịch sử điểm (point_transactions)
CREATE TABLE public.point_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  transaction_type point_transaction_type NOT NULL,
  points integer NOT NULL,
  balance_after integer NOT NULL DEFAULT 0,
  status point_status NOT NULL DEFAULT 'active',
  reference_type text, -- 'export_receipt', 'export_return', 'debt_payment', 'adjustment'
  reference_id uuid,
  description text NOT NULL,
  note text,
  created_by uuid REFERENCES auth.users(id),
  branch_id uuid REFERENCES public.branches(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. Bảng cấu hình tích điểm (point_settings)
CREATE TABLE public.point_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled boolean NOT NULL DEFAULT true,
  -- Tỷ lệ tích điểm: spend_amount VNĐ = earn_points điểm
  spend_amount numeric NOT NULL DEFAULT 10000,
  earn_points integer NOT NULL DEFAULT 1,
  -- Tỷ lệ đổi điểm: redeem_points điểm = redeem_value VNĐ
  redeem_points integer NOT NULL DEFAULT 1,
  redeem_value numeric NOT NULL DEFAULT 1000,
  -- Giới hạn đổi điểm (% giá trị đơn hàng)
  max_redeem_percentage numeric NOT NULL DEFAULT 30,
  -- Điểm có hết hạn không
  points_expire boolean NOT NULL DEFAULT false,
  points_expire_days integer DEFAULT 365,
  -- Chỉ cộng điểm khi đơn hàng hoàn tất (không có công nợ)
  require_full_payment boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- 5. Bảng cấu hình hạng thành viên
CREATE TABLE public.membership_tier_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier membership_tier NOT NULL UNIQUE,
  min_spent numeric NOT NULL DEFAULT 0,
  points_multiplier numeric NOT NULL DEFAULT 1,
  description text,
  benefits text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 6. Thêm cột vào export_receipts để theo dõi điểm
ALTER TABLE public.export_receipts
ADD COLUMN IF NOT EXISTS points_earned integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_redeemed integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_discount numeric DEFAULT 0;

-- 7. Insert default point settings
INSERT INTO public.point_settings (id, is_enabled, spend_amount, earn_points, redeem_points, redeem_value, max_redeem_percentage)
VALUES (gen_random_uuid(), true, 10000, 1, 1, 1000, 30);

-- 8. Insert default membership tiers
INSERT INTO public.membership_tier_settings (tier, min_spent, points_multiplier, description, benefits)
VALUES 
  ('regular', 0, 1, 'Khách hàng thường', 'Tích điểm cơ bản'),
  ('silver', 10000000, 1.2, 'Hạng Bạc', 'Tích điểm x1.2'),
  ('gold', 50000000, 1.5, 'Hạng Vàng', 'Tích điểm x1.5, Giảm giá 5%'),
  ('vip', 100000000, 2, 'Hạng VIP', 'Tích điểm x2, Giảm giá 10%, Ưu đãi đặc biệt');

-- 9. Enable RLS
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_tier_settings ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies for point_transactions
CREATE POLICY "Authenticated users can view point transactions"
ON public.point_transactions FOR SELECT
USING (is_authenticated());

CREATE POLICY "Authenticated users can insert point transactions"
ON public.point_transactions FOR INSERT
WITH CHECK (is_authenticated());

-- 11. RLS Policies for point_settings
CREATE POLICY "Authenticated users can view point settings"
ON public.point_settings FOR SELECT
USING (is_authenticated());

CREATE POLICY "Super admin can manage point settings"
ON public.point_settings FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- 12. RLS Policies for membership_tier_settings
CREATE POLICY "Authenticated users can view membership tiers"
ON public.membership_tier_settings FOR SELECT
USING (is_authenticated());

CREATE POLICY "Super admin can manage membership tiers"
ON public.membership_tier_settings FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- 13. Function to update customer membership tier based on total_spent
CREATE OR REPLACE FUNCTION public.update_customer_membership_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tier membership_tier;
BEGIN
  SELECT tier INTO new_tier
  FROM membership_tier_settings
  WHERE min_spent <= NEW.total_spent
  ORDER BY min_spent DESC
  LIMIT 1;
  
  IF new_tier IS NOT NULL AND new_tier != NEW.membership_tier THEN
    NEW.membership_tier := new_tier;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 14. Trigger to auto-update membership tier
CREATE TRIGGER trigger_update_membership_tier
BEFORE UPDATE OF total_spent ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_membership_tier();

-- 15. Index for performance
CREATE INDEX IF NOT EXISTS idx_point_transactions_customer ON public.point_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_reference ON public.point_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_customers_membership ON public.customers(membership_tier);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);