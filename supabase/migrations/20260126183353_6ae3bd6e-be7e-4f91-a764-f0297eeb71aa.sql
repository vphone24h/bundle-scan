-- Drop unique constraint on plan_type if exists
ALTER TABLE public.subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_plan_type_key;

-- Add new fields to subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS discount_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Create payment_config table for system settings
CREATE TABLE IF NOT EXISTS public.payment_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key text NOT NULL UNIQUE,
  config_value text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create bank_accounts table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment_config - only platform admins
CREATE POLICY "Platform admins can manage payment config" 
ON public.payment_config FOR ALL 
USING (is_platform_admin(auth.uid()));

-- Allow authenticated users to view payment config (for payment page)
CREATE POLICY "Authenticated users can view payment config" 
ON public.payment_config FOR SELECT 
USING (is_authenticated());

-- RLS policies for bank_accounts
CREATE POLICY "Platform admins can manage bank accounts" 
ON public.bank_accounts FOR ALL 
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Authenticated users can view active bank accounts" 
ON public.bank_accounts FOR SELECT 
USING (is_authenticated() AND is_active = true);

-- Insert default config
INSERT INTO public.payment_config (config_key, config_value) VALUES
  ('hotline', '0123456789'),
  ('support_email', 'support@khohangpro.com'),
  ('company_name', 'Kho Hàng Pro')
ON CONFLICT (config_key) DO NOTHING;

-- Update subscription_plans with more packages
DELETE FROM public.subscription_plans;
INSERT INTO public.subscription_plans (name, plan_type, price, duration_days, max_branches, max_users, description, is_active, display_order) VALUES
  ('Gói 1 tháng', 'monthly', 299000, 30, 2, 10, 'Phù hợp cho cửa hàng nhỏ', true, 1),
  ('Gói 3 tháng', 'monthly', 799000, 90, 3, 15, 'Tiết kiệm 11%', true, 2),
  ('Gói 6 tháng', 'monthly', 1499000, 180, 5, 20, 'Tiết kiệm 17%', true, 3),
  ('Gói 1 năm', 'yearly', 2799000, 365, 10, 30, 'Tiết kiệm 22%', true, 4),
  ('Gói 2 năm', 'yearly', 4999000, 730, 15, 50, 'Tiết kiệm 30%', true, 5),
  ('Gói 5 năm', 'lifetime', 9999000, 1825, 999, 999, 'Không giới hạn', true, 6);