
-- Recompute attendance status for records affected by approved correction requests in last 7 days
-- using Vietnam timezone (UTC+7) and the actual shift_assignment for that user/date.
WITH affected AS (
  SELECT DISTINCT ar.id AS att_id, ar.user_id, ar.tenant_id, ar.date, ar.check_in_time, ar.check_out_time
  FROM attendance_records ar
  JOIN attendance_correction_requests acr 
    ON acr.tenant_id = ar.tenant_id 
   AND acr.user_id = ar.user_id 
   AND acr.request_date = ar.date
  WHERE acr.status = 'approved' 
    AND acr.reviewed_at > now() - interval '7 day'
),
shifted AS (
  SELECT a.*,
    COALESCE(
      (SELECT ws.start_time FROM shift_assignments sa 
         JOIN work_shifts ws ON ws.id = sa.shift_id
        WHERE sa.user_id = a.user_id AND sa.tenant_id = a.tenant_id 
          AND sa.is_active = true AND sa.specific_date = a.date 
        LIMIT 1),
      (SELECT ws.start_time FROM shift_assignments sa 
         JOIN work_shifts ws ON ws.id = sa.shift_id
        WHERE sa.user_id = a.user_id AND sa.tenant_id = a.tenant_id 
          AND sa.is_active = true AND sa.assignment_type = 'fixed' 
          AND sa.day_of_week = EXTRACT(DOW FROM a.date)::int
        LIMIT 1)
    ) AS s_start,
    COALESCE(
      (SELECT ws.end_time FROM shift_assignments sa 
         JOIN work_shifts ws ON ws.id = sa.shift_id
        WHERE sa.user_id = a.user_id AND sa.tenant_id = a.tenant_id 
          AND sa.is_active = true AND sa.specific_date = a.date 
        LIMIT 1),
      (SELECT ws.end_time FROM shift_assignments sa 
         JOIN work_shifts ws ON ws.id = sa.shift_id
        WHERE sa.user_id = a.user_id AND sa.tenant_id = a.tenant_id 
          AND sa.is_active = true AND sa.assignment_type = 'fixed' 
          AND sa.day_of_week = EXTRACT(DOW FROM a.date)::int
        LIMIT 1)
    ) AS s_end,
    COALESCE(
      (SELECT ws.late_threshold_minutes FROM shift_assignments sa 
         JOIN work_shifts ws ON ws.id = sa.shift_id
        WHERE sa.user_id = a.user_id AND sa.tenant_id = a.tenant_id 
          AND sa.is_active = true AND sa.specific_date = a.date 
        LIMIT 1),
      (SELECT ws.late_threshold_minutes FROM shift_assignments sa 
         JOIN work_shifts ws ON ws.id = sa.shift_id
        WHERE sa.user_id = a.user_id AND sa.tenant_id = a.tenant_id 
          AND sa.is_active = true AND sa.assignment_type = 'fixed' 
          AND sa.day_of_week = EXTRACT(DOW FROM a.date)::int
        LIMIT 1),
      15
    ) AS late_thr
  FROM affected a
),
calc AS (
  SELECT s.att_id,
    s.s_start, s.s_end,
    -- shift_start in UTC = date(VN) + s_start - 7h
    ((s.date::timestamp + s.s_start) AT TIME ZONE 'Asia/Ho_Chi_Minh') AS shift_start_utc,
    ((s.date::timestamp + s.s_end)   AT TIME ZONE 'Asia/Ho_Chi_Minh') AS shift_end_utc,
    s.check_in_time, s.check_out_time, s.late_thr
  FROM shifted s
  WHERE s.s_start IS NOT NULL
)
UPDATE attendance_records ar
SET 
  late_minutes = GREATEST(0, CEIL(EXTRACT(EPOCH FROM (c.check_in_time - c.shift_start_utc)) / 60))::int,
  early_leave_minutes = CASE 
    WHEN c.check_out_time IS NULL THEN 0
    WHEN c.check_out_time < c.shift_end_utc 
      THEN CEIL(EXTRACT(EPOCH FROM (c.shift_end_utc - c.check_out_time)) / 60)::int
    ELSE 0 
  END,
  overtime_minutes = CASE 
    WHEN c.check_out_time IS NULL THEN 0
    WHEN c.check_out_time > c.shift_end_utc 
      THEN CEIL(EXTRACT(EPOCH FROM (c.check_out_time - c.shift_end_utc)) / 60)::int
    ELSE 0 
  END,
  status = CASE
    WHEN EXTRACT(EPOCH FROM (c.check_in_time - c.shift_start_utc)) / 60 > c.late_thr THEN 'late'
    WHEN c.check_out_time IS NOT NULL AND c.check_out_time < c.shift_end_utc THEN 'early_leave'
    ELSE 'on_time'
  END,
  total_work_minutes = CASE 
    WHEN c.check_out_time IS NULL THEN ar.total_work_minutes
    ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (c.check_out_time - c.check_in_time)) / 60)::int)
  END
FROM calc c
WHERE ar.id = c.att_id AND c.check_in_time IS NOT NULL;
