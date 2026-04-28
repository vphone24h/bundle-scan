-- 1. Thêm cột sold_count vào landing_products
ALTER TABLE public.landing_products
  ADD COLUMN IF NOT EXISTS sold_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS show_sold_count boolean NOT NULL DEFAULT true;

-- 2. Bảng đánh giá sản phẩm landing
CREATE TABLE IF NOT EXISTS public.landing_product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.landing_products(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  content text NOT NULL,
  rating smallint NOT NULL DEFAULT 5,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger thay cho CHECK
CREATE OR REPLACE FUNCTION public.validate_landing_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'rating must be between 1 and 5';
  END IF;
  IF length(trim(NEW.customer_name)) = 0 THEN
    RAISE EXCEPTION 'customer_name required';
  END IF;
  IF length(trim(NEW.customer_phone)) = 0 THEN
    RAISE EXCEPTION 'customer_phone required';
  END IF;
  IF length(trim(NEW.content)) = 0 THEN
    RAISE EXCEPTION 'content required';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_landing_review ON public.landing_product_reviews;
CREATE TRIGGER trg_validate_landing_review
  BEFORE INSERT OR UPDATE ON public.landing_product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_landing_review();

CREATE INDEX IF NOT EXISTS idx_landing_reviews_product ON public.landing_product_reviews(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_landing_reviews_tenant ON public.landing_product_reviews(tenant_id, created_at DESC);

ALTER TABLE public.landing_product_reviews ENABLE ROW LEVEL SECURITY;

-- Public có thể xem đánh giá visible
CREATE POLICY "Public can view visible reviews"
  ON public.landing_product_reviews FOR SELECT
  USING (is_visible = true);

-- Public có thể tạo đánh giá (khách gửi từ trang chi tiết)
CREATE POLICY "Public can create reviews"
  ON public.landing_product_reviews FOR INSERT
  WITH CHECK (true);

-- Tenant users quản lý toàn bộ
CREATE POLICY "Tenant users manage their reviews"
  ON public.landing_product_reviews FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_id_secure()))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_id_secure()));

-- 3. Trigger auto +1 sold_count khi có đơn landing mới
CREATE OR REPLACE FUNCTION public.increment_landing_sold_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.landing_products
       SET sold_count = COALESCE(sold_count, 0) + COALESCE(NEW.quantity, 1),
           updated_at = now()
     WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inc_landing_sold_count ON public.landing_orders;
CREATE TRIGGER trg_inc_landing_sold_count
  AFTER INSERT ON public.landing_orders
  FOR EACH ROW EXECUTE FUNCTION public.increment_landing_sold_count();