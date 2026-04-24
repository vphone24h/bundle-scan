
ALTER TABLE public.landing_products
  ADD COLUMN IF NOT EXISTS student_discount_label text DEFAULT 'HỌC SINH SINH VIÊN',
  ADD COLUMN IF NOT EXISTS student_discount_text text,
  ADD COLUMN IF NOT EXISTS installment_down_payment bigint;
