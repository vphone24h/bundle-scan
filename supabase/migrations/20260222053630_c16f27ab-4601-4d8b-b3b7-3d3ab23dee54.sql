-- Add send frequency: once, daily, weekly, monthly
ALTER TABLE public.notification_automations 
ADD COLUMN send_frequency text NOT NULL DEFAULT 'daily';

-- Add target audience filter
ALTER TABLE public.notification_automations 
ADD COLUMN target_audience text NOT NULL DEFAULT 'all';

-- Add comment for documentation
COMMENT ON COLUMN public.notification_automations.send_frequency IS 'once = 1 lần duy nhất, daily = 1 ngày/lần, weekly = 1 tuần/lần, monthly = 1 tháng/lần';
COMMENT ON COLUMN public.notification_automations.target_audience IS 'all = tất cả, active = đang hoạt động, trial = dùng thử, free = miễn phí (hết hạn), paid = đã mua gói';