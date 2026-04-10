ALTER TABLE public.crm_notifications DROP CONSTRAINT crm_notifications_notification_type_check;

ALTER TABLE public.crm_notifications ADD CONSTRAINT crm_notifications_notification_type_check
  CHECK (notification_type = ANY (ARRAY[
    'care_reminder', 'overdue_care', 'new_customer', 'kpi_update', 'system',
    'checkout_reminder', 'attendance_absent', 'checkin_reminder',
    'attendance_late', 'shift_reminder', 'payslip_ready'
  ]::text[]));