
-- Add cookie_tracking_days and default_commission_rate to affiliate_settings
ALTER TABLE public.affiliate_settings 
  ADD COLUMN IF NOT EXISTS cookie_tracking_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS default_commission_rate numeric NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS default_commission_type text NOT NULL DEFAULT 'percentage';

-- Create CTV product/category commission rates table
CREATE TABLE public.ctv_product_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('product', 'category')),
  target_id uuid NOT NULL,
  target_name text NOT NULL DEFAULT '',
  commission_type text NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  commission_value numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ctv_product_commissions ENABLE ROW LEVEL SECURITY;

-- Platform admin only policies
CREATE POLICY "Platform admins can manage ctv product commissions" ON public.ctv_product_commissions
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Allow authenticated users to read (for CTV to see commission rates)
CREATE POLICY "Authenticated users can read ctv product commissions" ON public.ctv_product_commissions
  FOR SELECT TO authenticated
  USING (true);
