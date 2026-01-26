-- Add description field to affiliate_settings table
ALTER TABLE public.affiliate_settings
ADD COLUMN IF NOT EXISTS commission_description TEXT DEFAULT 'Nhận hoa hồng khi giới thiệu bạn bè đăng ký và mua gói thành công. Hoa hồng sẽ được tự động cộng vào tài khoản sau khi đơn hàng được xác nhận.';