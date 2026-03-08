ALTER TABLE public.shop_ctv_settings
  ADD COLUMN IF NOT EXISTS f1_commission_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS f1_commission_type text NOT NULL DEFAULT 'percentage';