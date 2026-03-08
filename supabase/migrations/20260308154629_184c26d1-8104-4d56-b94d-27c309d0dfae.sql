
-- Add tiered commission fields to shop_ctv_settings
ALTER TABLE public.shop_ctv_settings 
ADD COLUMN IF NOT EXISTS commission_threshold numeric NOT NULL DEFAULT 5000000,
ADD COLUMN IF NOT EXISTS low_commission_rate numeric NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS low_commission_type text NOT NULL DEFAULT 'percentage',
ADD COLUMN IF NOT EXISTS high_commission_rate numeric NOT NULL DEFAULT 200000,
ADD COLUMN IF NOT EXISTS high_commission_type text NOT NULL DEFAULT 'fixed';

COMMENT ON COLUMN public.shop_ctv_settings.commission_threshold IS 'Ngưỡng giá trị đơn hàng để phân loại hoa hồng (VND)';
COMMENT ON COLUMN public.shop_ctv_settings.low_commission_rate IS 'Hoa hồng cho đơn dưới ngưỡng (%)';
COMMENT ON COLUMN public.shop_ctv_settings.high_commission_rate IS 'Hoa hồng cố định cho đơn trên ngưỡng (VND)';
