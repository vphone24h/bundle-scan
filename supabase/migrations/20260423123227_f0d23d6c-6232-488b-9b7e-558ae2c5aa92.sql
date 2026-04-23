
ALTER TABLE public.landing_products
ADD COLUMN IF NOT EXISTS package_selection_mode text NOT NULL DEFAULT 'multiple';

COMMENT ON COLUMN public.landing_products.package_selection_mode IS 'multiple = khách chọn nhiều gói, single = chỉ chọn 1 gói duy nhất';
