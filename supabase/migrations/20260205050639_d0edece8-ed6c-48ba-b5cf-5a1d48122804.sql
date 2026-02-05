-- =====================================================
-- CRM PHASE 1: Customer Tags, Contact Channels, 
-- Care Schedules, Staff Assignment
-- =====================================================

-- 1. CUSTOMER TAGS (Thẻ khách hàng)
-- Cho phép tạo tag tùy chỉnh với màu sắc
CREATE TABLE public.customer_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6', -- Màu hex
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Bảng liên kết nhiều-nhiều giữa customer và tags
CREATE TABLE public.customer_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES public.customer_tags(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, tag_id)
);

-- 2. CONTACT CHANNELS (Kênh liên hệ)
-- Lưu link Zalo, Facebook, TikTok của khách hàng
CREATE TABLE public.customer_contact_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('zalo', 'facebook', 'tiktok', 'other')),
  channel_url TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. CRM STATUS (Trạng thái CRM riêng biệt)
-- Thêm cột trạng thái CRM vào bảng customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS crm_status TEXT DEFAULT 'new' 
  CHECK (crm_status IN ('new', 'caring', 'purchased', 'inactive'));

-- 4. NHÂN VIÊN PHỤ TRÁCH
-- Thêm cột assigned_staff vào customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS assigned_staff_id UUID;

-- 5. NGÀY CHĂM SÓC GẦN NHẤT
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS last_care_date TIMESTAMPTZ;

-- 6. CARE SCHEDULE TYPES (Loại lịch chăm sóc)
CREATE TABLE public.care_schedule_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Insert default care types
INSERT INTO public.care_schedule_types (tenant_id, name, is_default, display_order) VALUES
(NULL, 'Bảo trì', true, 1),
(NULL, 'Bảo dưỡng', true, 2),
(NULL, 'Gọi tư vấn', true, 3),
(NULL, 'Chăm sóc định kỳ', true, 4);

-- 7. CARE SCHEDULES (Lịch chăm sóc)
CREATE TABLE public.customer_care_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  care_type_id UUID REFERENCES public.care_schedule_types(id),
  care_type_name TEXT NOT NULL, -- Lưu tên để hiển thị ngay cả khi type bị xóa
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  note TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'overdue')),
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  assigned_staff_id UUID,
  reminder_days INT DEFAULT 0, -- Nhắc trước bao nhiêu ngày
  reminder_sent BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. CUSTOMER CARE LOG (Nhật ký chăm sóc)
CREATE TABLE public.customer_care_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL, -- 'call', 'message', 'meeting', 'email', 'note', 'task_completed'
  content TEXT NOT NULL,
  result TEXT, -- Kết quả cuộc gọi/liên hệ
  schedule_id UUID REFERENCES public.customer_care_schedules(id) ON DELETE SET NULL,
  staff_id UUID NOT NULL,
  staff_name TEXT, -- Cache tên nhân viên
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. CARE REMINDERS (Thông báo nhắc việc)
CREATE TABLE public.care_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  schedule_id UUID REFERENCES public.customer_care_schedules(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL, -- Người nhận thông báo
  reminder_type TEXT DEFAULT 'app' CHECK (reminder_type IN ('app', 'email', 'both')),
  scheduled_for TIMESTAMPTZ NOT NULL, -- Thời điểm hiện thông báo
  is_read BOOLEAN DEFAULT false,
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contact_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_schedule_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_care_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_care_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_reminders ENABLE ROW LEVEL SECURITY;

-- Customer Tags policies
CREATE POLICY "Users can view tags of their tenant" ON public.customer_tags
  FOR SELECT USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can manage tags" ON public.customer_tags
  FOR ALL USING (public.is_tenant_admin(auth.uid()) AND public.user_belongs_to_tenant(tenant_id));

-- Tag Assignments policies  
CREATE POLICY "Users can view tag assignments" ON public.customer_tag_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.customers c 
      WHERE c.id = customer_id AND public.user_belongs_to_tenant(c.tenant_id)
    )
  );

CREATE POLICY "Staff can manage tag assignments" ON public.customer_tag_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.customers c 
      WHERE c.id = customer_id AND public.user_belongs_to_tenant(c.tenant_id)
    )
  );

-- Contact Channels policies
CREATE POLICY "Users can view contact channels" ON public.customer_contact_channels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.customers c 
      WHERE c.id = customer_id AND public.user_belongs_to_tenant(c.tenant_id)
    )
  );

CREATE POLICY "Staff can manage contact channels" ON public.customer_contact_channels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.customers c 
      WHERE c.id = customer_id AND public.user_belongs_to_tenant(c.tenant_id)
    )
  );

-- Care Schedule Types policies
CREATE POLICY "Users can view care types" ON public.care_schedule_types
  FOR SELECT USING (
    tenant_id IS NULL OR public.user_belongs_to_tenant(tenant_id)
  );

CREATE POLICY "Admins can manage care types" ON public.care_schedule_types
  FOR ALL USING (
    tenant_id IS NOT NULL AND public.is_tenant_admin(auth.uid()) AND public.user_belongs_to_tenant(tenant_id)
  );

-- Care Schedules policies
CREATE POLICY "Users view schedules of their tenant" ON public.customer_care_schedules
  FOR SELECT USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Staff can manage schedules" ON public.customer_care_schedules
  FOR ALL USING (public.user_belongs_to_tenant(tenant_id));

-- Care Logs policies
CREATE POLICY "Users view care logs of their tenant" ON public.customer_care_logs
  FOR SELECT USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Staff can create care logs" ON public.customer_care_logs
  FOR INSERT WITH CHECK (public.user_belongs_to_tenant(tenant_id));

-- Reminders policies (chỉ xem của mình)
CREATE POLICY "Users view their own reminders" ON public.care_reminders
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can manage reminders" ON public.care_reminders
  FOR ALL USING (public.user_belongs_to_tenant(tenant_id));

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_customer_tags_tenant ON public.customer_tags(tenant_id);
CREATE INDEX idx_customer_tag_assignments_customer ON public.customer_tag_assignments(customer_id);
CREATE INDEX idx_customer_tag_assignments_tag ON public.customer_tag_assignments(tag_id);
CREATE INDEX idx_customer_contact_channels_customer ON public.customer_contact_channels(customer_id);
CREATE INDEX idx_customer_care_schedules_tenant ON public.customer_care_schedules(tenant_id);
CREATE INDEX idx_customer_care_schedules_customer ON public.customer_care_schedules(customer_id);
CREATE INDEX idx_customer_care_schedules_date ON public.customer_care_schedules(scheduled_date);
CREATE INDEX idx_customer_care_schedules_status ON public.customer_care_schedules(status);
CREATE INDEX idx_customer_care_logs_customer ON public.customer_care_logs(customer_id);
CREATE INDEX idx_customer_care_logs_tenant ON public.customer_care_logs(tenant_id);
CREATE INDEX idx_care_reminders_user ON public.care_reminders(user_id);
CREATE INDEX idx_care_reminders_scheduled ON public.care_reminders(scheduled_for);
CREATE INDEX idx_customers_assigned_staff ON public.customers(assigned_staff_id);
CREATE INDEX idx_customers_crm_status ON public.customers(crm_status);
CREATE INDEX idx_customers_last_care_date ON public.customers(last_care_date);

-- =====================================================
-- TRIGGER: Auto update customers.last_care_date
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_customer_last_care_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.customers
  SET last_care_date = now()
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_last_care_date
AFTER INSERT ON public.customer_care_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_last_care_date();