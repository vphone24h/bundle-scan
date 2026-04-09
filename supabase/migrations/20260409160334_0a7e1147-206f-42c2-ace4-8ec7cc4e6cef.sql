
CREATE TABLE public.attendance_correction_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  attendance_id UUID REFERENCES public.attendance_records(id),
  request_type TEXT NOT NULL DEFAULT 'correction',
  request_date DATE NOT NULL,
  requested_check_in TIMESTAMPTZ,
  requested_check_out TIMESTAMPTZ,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_correction_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own corrections"
ON public.attendance_correction_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users create own corrections"
ON public.attendance_correction_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view tenant corrections"
ON public.attendance_correction_requests FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
    AND pu.tenant_id = attendance_correction_requests.tenant_id
    AND pu.platform_role IN ('tenant_admin'::public.platform_role, 'company_admin'::public.platform_role, 'platform_admin'::public.platform_role)
  )
);

CREATE POLICY "Admins update tenant corrections"
ON public.attendance_correction_requests FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
    AND pu.tenant_id = attendance_correction_requests.tenant_id
    AND pu.platform_role IN ('tenant_admin'::public.platform_role, 'company_admin'::public.platform_role, 'platform_admin'::public.platform_role)
  )
);

CREATE OR REPLACE FUNCTION public.notify_correction_request_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO public.crm_notifications (tenant_id, user_id, notification_type, title, message, reference_type, reference_id)
    VALUES (
      NEW.tenant_id, NEW.user_id,
      'correction_' || NEW.status,
      CASE WHEN NEW.status = 'approved' THEN 'Yêu cầu sửa công được duyệt' ELSE 'Yêu cầu sửa công bị từ chối' END,
      CASE WHEN NEW.status = 'approved' THEN 'Yêu cầu sửa công ngày ' || TO_CHAR(NEW.request_date, 'DD/MM/YYYY') || ' đã được duyệt.'
           ELSE 'Yêu cầu sửa công ngày ' || TO_CHAR(NEW.request_date, 'DD/MM/YYYY') || ' bị từ chối. Lý do: ' || COALESCE(NEW.review_note, 'Không rõ') END,
      'correction_request', NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_correction_status
AFTER UPDATE ON public.attendance_correction_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_correction_request_status();

CREATE OR REPLACE FUNCTION public.auto_checkout_expired()
RETURNS void AS $$
BEGIN
  UPDATE public.attendance_records ar
  SET check_out_time = (ar.date::date || ' ' || ws.end_time)::timestamptz,
      status = 'early_leave', is_auto_checkout = true,
      total_work_minutes = EXTRACT(EPOCH FROM ((ar.date::date || ' ' || ws.end_time)::timestamptz - ar.check_in_time)) / 60,
      updated_at = now()
  FROM public.work_shifts ws
  WHERE ar.shift_id = ws.id AND ar.status = 'pending' AND ar.check_out_time IS NULL AND ar.date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
