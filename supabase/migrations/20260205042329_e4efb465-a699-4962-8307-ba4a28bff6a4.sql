-- Add warranty_note column to products table
ALTER TABLE public.products ADD COLUMN warranty_note text;

-- Comment for documentation
COMMENT ON COLUMN public.products.warranty_note IS 'Ghi chú khi chuyển sản phẩm sang bảo hành';