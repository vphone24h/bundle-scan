
-- Add new columns to landing_products for 2-level variants, promotion, warranty sections
ALTER TABLE public.landing_products 
  ADD COLUMN IF NOT EXISTS variant_group_1_name text DEFAULT 'Màu sắc',
  ADD COLUMN IF NOT EXISTS variant_group_2_name text DEFAULT 'Dung lượng',
  ADD COLUMN IF NOT EXISTS variant_options_1 jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS variant_options_2 jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS variant_prices jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS promotion_title text DEFAULT 'KHUYẾN MÃI',
  ADD COLUMN IF NOT EXISTS promotion_content text,
  ADD COLUMN IF NOT EXISTS warranty_title text DEFAULT 'BẢO HÀNH',
  ADD COLUMN IF NOT EXISTS warranty_content text;

-- variant_options_1 format: [{"name":"Cam","image_url":"..."},{"name":"Trắng"},{"name":"Xanh"}]
-- variant_options_2 format: [{"name":"256GB"},{"name":"512GB"},{"name":"1TB"}]
-- variant_prices format: [{"option1":"Cam","option2":"256GB","price":36000000,"sale_price":35000000,"stock":5,"image_url":"..."}]

-- Add toggle settings to tenant_landing_settings
ALTER TABLE public.tenant_landing_settings
  ADD COLUMN IF NOT EXISTS show_promotion_section boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_warranty_section boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_installment_button boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_compare_products boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_trade_in boolean DEFAULT false;
