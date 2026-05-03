ALTER TABLE public.attendance_records 
ADD COLUMN IF NOT EXISTS accrued_offset_minutes integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.attendance_records.accrued_offset_minutes IS 'Số phút vào sớm/về trễ trong ngưỡng compensation_threshold còn DƯ cuối ngày (chưa dùng bù trừ). Được cộng dồn trong kỳ lương và quy đổi thành tăng ca theo đơn giá OT/giờ.';