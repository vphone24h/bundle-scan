
-- Add order_source column to landing_orders
ALTER TABLE public.landing_orders 
ADD COLUMN IF NOT EXISTS order_source text NOT NULL DEFAULT 'web';

-- Add ctv_name to landing_orders for display
ALTER TABLE public.landing_orders 
ADD COLUMN IF NOT EXISTS ctv_name text;

COMMENT ON COLUMN public.landing_orders.order_source IS 'web = khách lẻ, ctv_direct = CTV đặt hộ, ctv_referral = khách của CTV qua link ref';
