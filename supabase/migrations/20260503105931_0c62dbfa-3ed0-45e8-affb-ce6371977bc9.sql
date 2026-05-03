-- Thêm cờ phân biệt phiếu tự động (do hệ thống tạo khi check-in trễ / check-out sớm)
-- vs phiếu thủ công (NV tự gửi đơn xin phép)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS is_auto_detected boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leave_requests_auto_detected
ON public.leave_requests (tenant_id, is_auto_detected, status);

-- Khi NV gửi đơn thủ công (is_auto_detected = false) cho cùng user + cùng ngày + cùng request_type
-- mà đã tồn tại phiếu auto pending → xoá phiếu auto để gộp thành 1.
CREATE OR REPLACE FUNCTION public.merge_auto_leave_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_auto_detected = false THEN
    DELETE FROM public.leave_requests
    WHERE tenant_id = NEW.tenant_id
      AND user_id = NEW.user_id
      AND leave_date_from = NEW.leave_date_from
      AND leave_date_to = NEW.leave_date_to
      AND request_type = NEW.request_type
      AND is_auto_detected = true
      AND status = 'pending'
      AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_merge_auto_leave_request ON public.leave_requests;
CREATE TRIGGER trg_merge_auto_leave_request
AFTER INSERT ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.merge_auto_leave_request();