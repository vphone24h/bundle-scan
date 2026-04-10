
-- Salary advances table
CREATE TABLE IF NOT EXISTS public.salary_advances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejected_by UUID,
  rejected_at TIMESTAMPTZ,
  reject_reason TEXT,
  paid_at TIMESTAMPTZ,
  paid_by UUID,
  payroll_period_id UUID REFERENCES public.payroll_periods(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own salary advances"
  ON public.salary_advances FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users create own salary advances"
  ON public.salary_advances FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Admin update salary advances"
  ON public.salary_advances FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid() AND platform_role IN ('tenant_admin', 'platform_admin', 'company_admin'))
  );

-- Attendance locks table
CREATE TABLE IF NOT EXISTS public.attendance_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  locked_by UUID NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view attendance locks"
  ON public.attendance_locks FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE POLICY "Admin create attendance locks"
  ON public.attendance_locks FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid() AND platform_role IN ('tenant_admin', 'platform_admin', 'company_admin'))
  );

CREATE POLICY "Admin delete attendance locks"
  ON public.attendance_locks FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid() AND platform_role IN ('tenant_admin', 'platform_admin', 'company_admin'))
  );

-- Trigger to prevent editing locked attendance
CREATE OR REPLACE FUNCTION public.check_attendance_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.attendance_locks
    WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id)
    AND period_start <= COALESCE(NEW.date, OLD.date)::date
    AND period_end >= COALESCE(NEW.date, OLD.date)::date
  ) THEN
    RAISE EXCEPTION 'Dữ liệu chấm công đã bị khóa trong khoảng thời gian này';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_attendance_lock ON public.attendance_records;
CREATE TRIGGER trg_check_attendance_lock
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.check_attendance_lock();

-- Notification trigger for salary advance status changes
CREATE OR REPLACE FUNCTION public.notify_salary_advance_status()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.crm_notifications (tenant_id, user_id, notification_type, title, message, reference_type, reference_id)
    VALUES (
      NEW.tenant_id, NEW.user_id,
      CASE WHEN NEW.status = 'approved' THEN 'advance_approved' WHEN NEW.status = 'rejected' THEN 'advance_rejected' WHEN NEW.status = 'paid' THEN 'advance_paid' ELSE 'advance_update' END,
      CASE WHEN NEW.status = 'approved' THEN 'Tạm ứng được duyệt' WHEN NEW.status = 'rejected' THEN 'Tạm ứng bị từ chối' WHEN NEW.status = 'paid' THEN 'Tạm ứng đã chi' ELSE 'Cập nhật tạm ứng' END,
      CASE WHEN NEW.status = 'approved' THEN 'Yêu cầu tạm ứng ' || TO_CHAR(NEW.amount, 'FM999,999,999') || 'đ đã được duyệt'
           WHEN NEW.status = 'rejected' THEN 'Yêu cầu tạm ứng bị từ chối' || COALESCE('. Lý do: ' || NEW.reject_reason, '')
           WHEN NEW.status = 'paid' THEN 'Tạm ứng ' || TO_CHAR(NEW.amount, 'FM999,999,999') || 'đ đã được chi trả'
           ELSE 'Tạm ứng đã được cập nhật' END,
      'salary_advance', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_salary_advance ON public.salary_advances;
CREATE TRIGGER trg_notify_salary_advance
  AFTER UPDATE ON public.salary_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_salary_advance_status();
