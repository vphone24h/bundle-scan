ALTER TABLE public.tenants
  ALTER COLUMN compensation_threshold_minutes DROP NOT NULL,
  ALTER COLUMN compensation_threshold_minutes DROP DEFAULT;

COMMENT ON COLUMN public.tenants.compensation_threshold_minutes IS 'Ngưỡng net bù trừ trong ngày (phút). NULL hoặc 0 = không bù trừ — mọi chênh lệch phải xin phép/tăng ca. >0 = phần trong ngưỡng coi như đủ công, vượt ngưỡng mới tạo phiếu duyệt.';