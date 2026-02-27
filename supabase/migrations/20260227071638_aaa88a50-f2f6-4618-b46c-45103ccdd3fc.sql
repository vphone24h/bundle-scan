-- Fix triệt để lỗi nguồn tiền tùy chỉnh khi ghi sổ quỹ từ các nghiệp vụ Xuất/Nhập/Thu nợ/Chuyển tiền
-- Nguyên nhân: ràng buộc cứng chỉ cho phép 3 nguồn mặc định
ALTER TABLE public.cash_book
DROP CONSTRAINT IF EXISTS cash_book_payment_source_check;