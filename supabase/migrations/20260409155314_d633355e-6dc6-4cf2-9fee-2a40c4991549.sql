
-- Trigger function: auto-create notification on late check-in
CREATE OR REPLACE FUNCTION public.notify_attendance_late()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'late' AND NEW.late_minutes > 0 THEN
    INSERT INTO public.crm_notifications (
      tenant_id, user_id, notification_type, title, message,
      reference_type, reference_id
    ) VALUES (
      NEW.tenant_id,
      NEW.user_id,
      'attendance_late',
      'Chấm công trễ',
      'Bạn đã check-in trễ ' || COALESCE(NEW.late_minutes, 0) || ' phút vào ngày ' || TO_CHAR(NEW.date::date, 'DD/MM/YYYY'),
      'attendance',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on attendance_records
DROP TRIGGER IF EXISTS trg_notify_attendance_late ON public.attendance_records;
CREATE TRIGGER trg_notify_attendance_late
  AFTER INSERT ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_attendance_late();
