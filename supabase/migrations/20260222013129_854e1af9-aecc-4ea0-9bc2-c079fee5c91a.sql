
-- Notification automation rules
CREATE TABLE public.notification_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_type TEXT NOT NULL, -- 'new_signup', 'inactive_1d', 'inactive_3d', 'inactive_7d', 'trial_expiring', 'low_stock', 'slow_stock'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  full_content TEXT,
  link_url TEXT,
  button_text TEXT,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  channels TEXT[] NOT NULL DEFAULT ARRAY['bell']::TEXT[], -- 'bell', 'popup', 'email'
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage automations"
  ON public.notification_automations FOR ALL
  USING (public.is_platform_admin(auth.uid()));

-- Execution logs to avoid duplicate sends
CREATE TABLE public.automation_execution_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID NOT NULL REFERENCES public.notification_automations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  channel TEXT NOT NULL DEFAULT 'bell',
  UNIQUE(automation_id, user_id, channel)
);

ALTER TABLE public.automation_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view logs"
  ON public.automation_execution_logs FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "System can insert logs"
  ON public.automation_execution_logs FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_automation_logs_user ON public.automation_execution_logs(user_id, automation_id);
CREATE INDEX idx_automation_logs_tenant ON public.automation_execution_logs(tenant_id);

-- Seed default automation rules
INSERT INTO public.notification_automations (trigger_type, title, message, button_text, link_url, delay_minutes, display_order) VALUES
('new_signup', 'Chào mừng bạn đến với vKho!', 'Bắt đầu nhập sản phẩm đầu tiên để quản lý kho hiệu quả hơn.', 'Bắt đầu ngay', '/import/new', 5, 1),
('inactive_1d', 'Bạn chưa nhập sản phẩm nào', 'Bạn đã tạo tài khoản nhưng chưa nhập sản phẩm nào. Chỉ mất 1 phút để bắt đầu.', 'Nhập sản phẩm', '/import/new', 1440, 2),
('inactive_3d', 'vKho giúp bạn quản lý hiệu quả', 'vKho có thể giúp bạn: Quản lý tồn kho, Theo dõi lời lỗ, Tránh thất thoát. Bắt đầu ngay nhé!', 'Bắt đầu ngay', '/import/new', 4320, 3),
('inactive_7d', 'Ưu đãi đặc biệt dành cho bạn', 'Đừng bỏ lỡ cơ hội quản lý kho miễn phí. Hãy thử ngay hôm nay!', 'Dùng thử ngay', '/', 10080, 4),
('trial_expiring', 'Tài khoản sắp hết hạn dùng thử', 'Tài khoản của bạn sắp hết thời gian dùng thử. Nâng cấp để không bị gián đoạn.', 'Nâng cấp ngay', '/subscription', 0, 5),
('low_stock', 'Cảnh báo sắp hết hàng', 'Một số sản phẩm trong kho sắp hết hàng. Kiểm tra ngay để bổ sung kịp thời.', 'Xem kho', '/inventory', 0, 6);

-- Trigger for updated_at
CREATE TRIGGER update_notification_automations_updated_at
  BEFORE UPDATE ON public.notification_automations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
