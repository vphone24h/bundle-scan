ALTER TABLE public.product_deposits ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

-- Bỏ ràng buộc unique active per product (nếu có) vì sản phẩm không IMEI có thể nhiều khách cọc nhiều lần
-- (Code hiện tại đang chặn bằng query JS, ta sẽ điều chỉnh logic chặn ở code thay vì DB)