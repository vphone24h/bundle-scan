-- Extend allowed notification types
ALTER TABLE public.crm_notifications DROP CONSTRAINT IF EXISTS crm_notifications_notification_type_check;
ALTER TABLE public.crm_notifications ADD CONSTRAINT crm_notifications_notification_type_check
CHECK (notification_type = ANY (ARRAY[
  'care_reminder','overdue_care','new_customer','kpi_update','system',
  'checkout_reminder','attendance_absent','checkin_reminder','attendance_late',
  'shift_reminder','payslip_ready','correction_approved','correction_rejected'
]));

-- Fix UUID cast in trigger
CREATE OR REPLACE FUNCTION public.notify_correction_request_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO public.crm_notifications (tenant_id, user_id, notification_type, title, message, reference_type, reference_id)
    VALUES (
      NEW.tenant_id, NEW.user_id,
      'correction_' || NEW.status,
      CASE WHEN NEW.status = 'approved' THEN 'Yêu cầu sửa công được duyệt' ELSE 'Yêu cầu sửa công bị từ chối' END,
      CASE WHEN NEW.status = 'approved' THEN 'Yêu cầu sửa công ngày ' || TO_CHAR(NEW.request_date, 'DD/MM/YYYY') || ' đã được duyệt.'
           ELSE 'Yêu cầu sửa công ngày ' || TO_CHAR(NEW.request_date, 'DD/MM/YYYY') || ' bị từ chối. Lý do: ' || COALESCE(NEW.review_note, 'Không rõ') END,
      'correction_request', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;