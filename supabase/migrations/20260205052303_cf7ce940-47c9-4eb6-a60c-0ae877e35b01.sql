
-- =====================================================
-- PHASE 2: KPI SYSTEM & NOTIFICATIONS
-- =====================================================

-- 1. Staff KPI Settings Table
CREATE TABLE public.staff_kpi_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  kpi_type TEXT NOT NULL CHECK (kpi_type IN ('revenue', 'orders')),
  target_value NUMERIC NOT NULL DEFAULT 0,
  period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID,
  UNIQUE(tenant_id, user_id)
);

-- Enable RLS
ALTER TABLE public.staff_kpi_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_kpi_settings
CREATE POLICY "Users can view KPI settings in their tenant"
  ON public.staff_kpi_settings FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_id_secure()));

CREATE POLICY "Admins can manage KPI settings"
  ON public.staff_kpi_settings FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_id_secure()));

-- 2. Staff Performance Snapshots (for historical tracking)
CREATE TABLE public.staff_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_revenue NUMERIC DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_customers INTEGER DEFAULT 0,
  total_leads INTEGER DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  kpi_achievement_percentage NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.staff_performance_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_performance_snapshots
CREATE POLICY "Users can view performance in their tenant"
  ON public.staff_performance_snapshots FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_id_secure()));

CREATE POLICY "System can manage performance snapshots"
  ON public.staff_performance_snapshots FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_id_secure()));

-- 3. CRM Notifications Table (In-App Notifications)
CREATE TABLE public.crm_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('care_reminder', 'overdue_care', 'new_customer', 'kpi_update', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  is_email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.crm_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crm_notifications
CREATE POLICY "Users can view their own notifications"
  ON public.crm_notifications FOR SELECT
  USING (
    tenant_id IN (SELECT get_user_tenant_id_secure()) 
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own notifications"
  ON public.crm_notifications FOR UPDATE
  USING (
    tenant_id IN (SELECT get_user_tenant_id_secure()) 
    AND user_id = auth.uid()
  );

CREATE POLICY "System can insert notifications"
  ON public.crm_notifications FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_id_secure()));

-- 4. Email Queue Table (for sending emails)
CREATE TABLE public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID,
  email_type TEXT NOT NULL CHECK (email_type IN ('care_reminder', 'overdue_care', 'daily_summary', 'kpi_report')),
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  retry_count INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_queue
CREATE POLICY "Admins can view email queue"
  ON public.email_queue FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_id_secure()));

-- 5. Update care_reminders to add notification preferences
ALTER TABLE public.care_reminders 
  ADD COLUMN IF NOT EXISTS email_scheduled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS app_notification_sent BOOLEAN DEFAULT false;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_kpi_tenant_user ON public.staff_kpi_settings(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_performance_tenant_user ON public.staff_performance_snapshots(tenant_id, user_id, period_start);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.crm_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status, scheduled_for) WHERE status = 'pending';

-- 7. Function to calculate staff KPI stats
CREATE OR REPLACE FUNCTION public.get_staff_kpi_stats(
  p_tenant_id UUID,
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_revenue NUMERIC,
  total_orders INTEGER,
  total_customers INTEGER,
  new_customers INTEGER,
  conversion_rate NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH staff_sales AS (
    SELECT 
      COALESCE(SUM(er.total_amount), 0) as revenue,
      COUNT(DISTINCT er.id) as orders
    FROM export_receipts er
    WHERE er.tenant_id = p_tenant_id
      AND er.created_by = p_user_id
      AND er.status = 'completed'
      AND er.export_date >= p_start_date
      AND er.export_date < p_end_date + INTERVAL '1 day'
  ),
  staff_customers AS (
    SELECT 
      COUNT(DISTINCT c.id) as total,
      COUNT(DISTINCT CASE WHEN c.created_at >= p_start_date AND c.created_at < p_end_date + INTERVAL '1 day' THEN c.id END) as new_count
    FROM customers c
    WHERE c.tenant_id = p_tenant_id
      AND c.assigned_staff_id = p_user_id
  ),
  staff_care AS (
    SELECT
      COUNT(CASE WHEN status = 'completed' THEN 1 END)::NUMERIC as completed,
      COUNT(*)::NUMERIC as total_tasks
    FROM customer_care_schedules
    WHERE tenant_id = p_tenant_id
      AND assigned_staff_id = p_user_id
      AND scheduled_date >= p_start_date
      AND scheduled_date <= p_end_date
  )
  SELECT 
    ss.revenue,
    ss.orders::INTEGER,
    sc.total::INTEGER,
    sc.new_count::INTEGER,
    CASE WHEN care.total_tasks > 0 THEN ROUND((care.completed / care.total_tasks) * 100, 2) ELSE 0 END
  FROM staff_sales ss
  CROSS JOIN staff_customers sc
  CROSS JOIN staff_care care;
END;
$$;

-- 8. Function to create care reminder notifications
CREATE OR REPLACE FUNCTION public.create_care_reminder_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  schedule_record RECORD;
  staff_email TEXT;
BEGIN
  -- Find schedules due today or overdue
  FOR schedule_record IN 
    SELECT 
      ccs.id,
      ccs.tenant_id,
      ccs.customer_id,
      ccs.care_type_name,
      ccs.scheduled_date,
      ccs.assigned_staff_id,
      c.name as customer_name,
      c.phone as customer_phone
    FROM customer_care_schedules ccs
    JOIN customers c ON c.id = ccs.customer_id
    WHERE ccs.status = 'pending'
      AND ccs.scheduled_date <= CURRENT_DATE
      AND ccs.assigned_staff_id IS NOT NULL
  LOOP
    -- Create in-app notification
    INSERT INTO crm_notifications (
      tenant_id,
      user_id,
      notification_type,
      title,
      message,
      reference_type,
      reference_id
    )
    SELECT 
      schedule_record.tenant_id,
      schedule_record.assigned_staff_id,
      CASE WHEN schedule_record.scheduled_date < CURRENT_DATE THEN 'overdue_care' ELSE 'care_reminder' END,
      CASE WHEN schedule_record.scheduled_date < CURRENT_DATE 
        THEN 'Quá hạn chăm sóc: ' || schedule_record.customer_name
        ELSE 'Nhắc chăm sóc: ' || schedule_record.customer_name
      END,
      'Loại: ' || schedule_record.care_type_name || ' - SĐT: ' || COALESCE(schedule_record.customer_phone, 'N/A'),
      'care_schedule',
      schedule_record.id
    WHERE NOT EXISTS (
      SELECT 1 FROM crm_notifications 
      WHERE reference_id = schedule_record.id 
        AND notification_type IN ('care_reminder', 'overdue_care')
        AND DATE(created_at) = CURRENT_DATE
    );
  END LOOP;
END;
$$;

-- 9. Trigger to update overdue schedules
CREATE OR REPLACE FUNCTION public.update_overdue_care_schedules()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE customer_care_schedules
  SET status = 'overdue'
  WHERE status = 'pending'
    AND scheduled_date < CURRENT_DATE;
END;
$$;
