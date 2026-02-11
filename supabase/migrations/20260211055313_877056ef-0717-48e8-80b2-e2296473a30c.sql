
-- Add images array column to landing_products for multiple product images
ALTER TABLE public.landing_products ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb;
