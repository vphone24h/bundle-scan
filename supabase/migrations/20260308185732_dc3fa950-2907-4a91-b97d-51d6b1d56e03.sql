
ALTER TABLE public.landing_orders 
ADD COLUMN IF NOT EXISTS shipping_carrier text,
ADD COLUMN IF NOT EXISTS tracking_number text,
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pending';
