DROP INDEX IF EXISTS public.leave_requests_user_overlap_idx;

CREATE UNIQUE INDEX IF NOT EXISTS leave_requests_user_period_type_idx
ON public.leave_requests (
  user_id,
  leave_date_from,
  leave_date_to,
  COALESCE(request_type, 'full_day'::text)
)
WHERE status <> 'rejected';

INSERT INTO public.leave_requests (
  user_id,
  tenant_id,
  reason,
  status,
  leave_date_from,
  leave_date_to,
  request_type,
  time_minutes,
  deduct_salary,
  is_auto_detected
)
SELECT
  ar.user_id,
  ar.tenant_id,
  '[Tự động] Đi trễ ' || ar.late_minutes || 'p — chờ admin duyệt',
  'pending',
  ar.date,
  ar.date,
  'late_arrival',
  ar.late_minutes,
  false,
  true
FROM public.attendance_records ar
WHERE COALESCE(ar.late_minutes, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.leave_requests lr
    WHERE lr.user_id = ar.user_id
      AND lr.leave_date_from = ar.date
      AND lr.leave_date_to = ar.date
      AND COALESCE(lr.request_type, 'full_day') = 'late_arrival'
      AND lr.status <> 'rejected'
  );

INSERT INTO public.leave_requests (
  user_id,
  tenant_id,
  reason,
  status,
  leave_date_from,
  leave_date_to,
  request_type,
  time_minutes,
  deduct_salary,
  is_auto_detected
)
SELECT
  ar.user_id,
  ar.tenant_id,
  '[Tự động] Về sớm ' || ar.early_leave_minutes || 'p — chờ admin duyệt',
  'pending',
  ar.date,
  ar.date,
  'early_leave',
  ar.early_leave_minutes,
  false,
  true
FROM public.attendance_records ar
WHERE COALESCE(ar.early_leave_minutes, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.leave_requests lr
    WHERE lr.user_id = ar.user_id
      AND lr.leave_date_from = ar.date
      AND lr.leave_date_to = ar.date
      AND COALESCE(lr.request_type, 'full_day') = 'early_leave'
      AND lr.status <> 'rejected'
  );