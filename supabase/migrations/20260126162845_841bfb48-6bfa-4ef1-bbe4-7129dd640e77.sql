-- =====================================================
-- THÊM CỘT QUANTITY VÀ TOTAL_IMPORT_COST CHO PRODUCTS
-- =====================================================

-- Thêm cột quantity để lưu số lượng cho sản phẩm không IMEI
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

-- Thêm cột total_import_cost để tính giá nhập trung bình
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS total_import_cost numeric;

-- Cập nhật dữ liệu hiện có: total_import_cost = import_price * quantity
UPDATE public.products 
SET total_import_cost = import_price * quantity 
WHERE total_import_cost IS NULL;

-- Set NOT NULL sau khi đã có dữ liệu
ALTER TABLE public.products ALTER COLUMN total_import_cost SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN total_import_cost SET DEFAULT 0;

-- =====================================================
-- TẠO BẢNG PRODUCT_IMPORTS ĐỂ LƯU LỊCH SỬ NHẬP HÀNG
-- =====================================================
CREATE TABLE IF NOT EXISTS public.product_imports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    import_receipt_id uuid REFERENCES public.import_receipts(id) ON DELETE SET NULL,
    quantity integer NOT NULL DEFAULT 1,
    import_price numeric NOT NULL,
    import_date timestamp with time zone NOT NULL DEFAULT now(),
    supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
    note text,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_imports ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view product imports"
ON public.product_imports FOR SELECT
USING (is_authenticated());

CREATE POLICY "Authenticated users can manage product imports"
ON public.product_imports FOR ALL
USING (is_authenticated());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_imports_product_id ON public.product_imports(product_id);
CREATE INDEX IF NOT EXISTS idx_product_imports_receipt_id ON public.product_imports(import_receipt_id);

-- Index cho tìm kiếm sản phẩm không IMEI theo name + sku + branch
CREATE INDEX IF NOT EXISTS idx_products_non_imei_lookup 
ON public.products (name, sku, branch_id, status) 
WHERE imei IS NULL;