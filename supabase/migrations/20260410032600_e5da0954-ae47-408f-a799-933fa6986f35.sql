
-- Tạo hàm an toàn để mọi tài khoản đã đăng nhập đọc được trạng thái chấm công theo company_id
-- Bypass RLS của bảng companies mà không mở quyền đọc toàn bộ bảng
CREATE OR REPLACE FUNCTION public.get_company_attendance_enabled(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT attendance_enabled FROM public.companies WHERE id = _company_id AND status = 'active'),
    false
  );
$$;
