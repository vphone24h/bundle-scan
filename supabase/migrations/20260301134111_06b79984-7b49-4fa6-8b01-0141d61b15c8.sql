-- Add home_tab_ids column to landing_products for assigning products to custom homepage tabs
ALTER TABLE public.landing_products ADD COLUMN IF NOT EXISTS home_tab_ids text[] DEFAULT '{}';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_landing_products_home_tab_ids ON public.landing_products USING GIN(home_tab_ids);