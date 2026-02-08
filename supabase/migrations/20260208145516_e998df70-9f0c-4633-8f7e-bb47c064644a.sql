
-- Thêm trường người nhận và người lập phiếu vào bảng cash_book
ALTER TABLE public.cash_book 
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS created_by_name text;

-- Comment cho các cột mới
COMMENT ON COLUMN public.cash_book.recipient_name IS 'Tên người nhận tiền (chi) hoặc người nộp tiền (thu)';
COMMENT ON COLUMN public.cash_book.recipient_phone IS 'SĐT người nhận/nộp tiền';
COMMENT ON COLUMN public.cash_book.created_by_name IS 'Tên nhân viên lập phiếu (snapshot tại thời điểm tạo)';
