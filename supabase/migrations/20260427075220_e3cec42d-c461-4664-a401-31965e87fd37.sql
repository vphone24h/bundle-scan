
-- Thêm 2 cờ ẩn riêng cho danh mục sản phẩm
ALTER TABLE public.landing_product_categories
  ADD COLUMN IF NOT EXISTS hidden_from_home boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_from_products_page boolean NOT NULL DEFAULT false;

-- Migrate dữ liệu cũ: nếu is_hidden=true thì ẩn cả 2 nơi
UPDATE public.landing_product_categories
SET hidden_from_home = true, hidden_from_products_page = true
WHERE is_hidden = true;

-- Thêm 2 cờ ẩn riêng cho danh mục bài viết
ALTER TABLE public.landing_article_categories
  ADD COLUMN IF NOT EXISTS hidden_from_home boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_from_articles_page boolean NOT NULL DEFAULT false;

-- Migrate dữ liệu cũ: nếu is_visible=false thì ẩn cả 2 nơi
UPDATE public.landing_article_categories
SET hidden_from_home = true, hidden_from_articles_page = true
WHERE is_visible = false;
