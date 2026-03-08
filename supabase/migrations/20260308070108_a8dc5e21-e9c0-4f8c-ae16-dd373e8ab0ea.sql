
CREATE TABLE public.platform_email_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'signup_days',
  trigger_days INTEGER NOT NULL DEFAULT 7,
  subject TEXT NOT NULL DEFAULT '',
  html_content TEXT NOT NULL DEFAULT '',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  target_audience TEXT NOT NULL DEFAULT 'all',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_email_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage email automations"
  ON public.platform_email_automations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE user_id = auth.uid() AND platform_role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE user_id = auth.uid() AND platform_role = 'platform_admin'
    )
  );

-- Execution logs
CREATE TABLE public.platform_email_automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID REFERENCES public.platform_email_automations(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_email_automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view email automation logs"
  ON public.platform_email_automation_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE user_id = auth.uid() AND platform_role = 'platform_admin'
    )
  );

-- Insert default automation scenarios
INSERT INTO public.platform_email_automations (name, trigger_type, trigger_days, subject, html_content) VALUES
('Chào mừng sau 1 ngày', 'signup_days', 1, 'Chào mừng bạn đến với VKho! 🎉', '<h2>Xin chào {{tenant_name}}!</h2><p>Cảm ơn bạn đã đăng ký sử dụng VKho. Chúng tôi rất vui được đồng hành cùng bạn.</p><p>Bạn đã khám phá các tính năng quản lý kho, bán hàng và báo cáo chưa? Hãy bắt đầu ngay!</p><p><a href="https://vkho.vn">Truy cập VKho ngay →</a></p>'),
('Nhắc nhở sau 7 ngày', 'signup_days', 7, 'Bạn đã sử dụng VKho được 1 tuần! 📊', '<h2>Chào {{tenant_name}}!</h2><p>Đã 1 tuần kể từ khi bạn đăng ký. Bạn đã thử nhập hàng, xuất hàng hay xem báo cáo chưa?</p><p>Nếu cần hỗ trợ, đừng ngần ngại liên hệ chúng tôi nhé!</p>'),
('Khách không hoạt động 3 ngày', 'inactive_days', 3, 'VKho nhớ bạn! Quay lại nhé 👋', '<h2>Chào {{tenant_name}}!</h2><p>Chúng tôi nhận thấy bạn chưa đăng nhập trong 3 ngày qua. Có vấn đề gì không?</p><p>Hãy quay lại và tiếp tục quản lý cửa hàng của bạn nhé!</p>'),
('Khách không hoạt động 7 ngày', 'inactive_days', 7, 'Đừng bỏ lỡ! VKho có nhiều tính năng mới 🚀', '<h2>Chào {{tenant_name}}!</h2><p>Đã 7 ngày rồi bạn chưa ghé thăm. Chúng tôi đã cập nhật nhiều tính năng mới giúp bạn quản lý hiệu quả hơn!</p><p><a href="https://vkho.vn">Khám phá ngay →</a></p>'),
('Sắp hết dùng thử', 'trial_expiring', 3, 'Gói dùng thử sắp hết hạn ⏰', '<h2>Chào {{tenant_name}}!</h2><p>Gói dùng thử của bạn sẽ hết hạn trong 3 ngày nữa. Nâng cấp ngay để tiếp tục sử dụng đầy đủ tính năng!</p><p><a href="https://vkho.vn/subscription">Xem các gói →</a></p>');
