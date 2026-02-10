-- Add sale_price column to products table (nullable, not required)
ALTER TABLE public.products ADD COLUMN sale_price numeric DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.products.sale_price IS 'Giá bán gợi ý. IMEI: giá nhập + 2tr. Non-IMEI: giá nhập x2. Có thể sửa.';