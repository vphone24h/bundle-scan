
-- Thêm cột video_url vào advertisements
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Tạo bảng cài đặt Ad Gate
CREATE TABLE IF NOT EXISTS public.ad_gate_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  display_duration_seconds INTEGER NOT NULL DEFAULT 15,
  is_skippable BOOLEAN NOT NULL DEFAULT true,
  skip_after_seconds INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chèn cài đặt mặc định
INSERT INTO public.ad_gate_settings (is_enabled, display_duration_seconds, is_skippable, skip_after_seconds)
VALUES (false, 15, true, 5);

-- Enable RLS
ALTER TABLE public.ad_gate_settings ENABLE ROW LEVEL SECURITY;

-- Bất kỳ ai cũng đọc được cài đặt (cần để hiển thị quảng cáo cho người dùng hết hạn)
CREATE POLICY "Anyone can read ad gate settings"
  ON public.ad_gate_settings FOR SELECT
  USING (true);

-- Chỉ platform admin mới được chỉnh sửa
CREATE POLICY "Platform admin can manage ad gate settings"
  ON public.ad_gate_settings FOR ALL
  USING (public.is_platform_admin(auth.uid()));

-- Trigger cập nhật updated_at
CREATE TRIGGER update_ad_gate_settings_updated_at
  BEFORE UPDATE ON public.ad_gate_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
