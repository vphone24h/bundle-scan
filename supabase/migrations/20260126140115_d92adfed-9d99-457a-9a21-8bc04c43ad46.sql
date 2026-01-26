-- 1. Tạo enum mới cho 4 loại role
CREATE TYPE public.user_role AS ENUM ('super_admin', 'branch_admin', 'staff', 'cashier');

-- 2. Thêm cột branch_id và role mới vào user_roles
ALTER TABLE public.user_roles 
ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
ADD COLUMN user_role public.user_role DEFAULT 'staff';

-- 3. Migrate data từ app_role sang user_role
UPDATE public.user_roles 
SET user_role = CASE 
  WHEN role = 'admin' THEN 'super_admin'::public.user_role
  ELSE 'staff'::public.user_role
END;

-- 4. Tạo bảng audit_logs để ghi lại thao tác
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL, -- 'create', 'update', 'delete', 'view', 'login', 'logout'
  table_name text,
  record_id uuid,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  old_data jsonb,
  new_data jsonb,
  description text,
  ip_address text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 5. Enable RLS trên audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. Policy cho audit_logs - chỉ super_admin xem tất cả, branch_admin xem chi nhánh mình
CREATE POLICY "Super admin can view all audit logs"
ON public.audit_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND user_role = 'super_admin'
  )
);

CREATE POLICY "Branch admin can view branch audit logs"
ON public.audit_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND user_role = 'branch_admin'
    AND branch_id = audit_logs.branch_id
  )
);

CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (is_authenticated());

-- 7. Tạo function để lấy role của user
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- 8. Tạo function để lấy branch_id của user
CREATE OR REPLACE FUNCTION public.get_user_branch(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- 9. Tạo function kiểm tra user có quyền xem branch không
CREATE OR REPLACE FUNCTION public.can_access_branch(_user_id uuid, _branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND (
      user_role = 'super_admin' 
      OR branch_id = _branch_id
      OR _branch_id IS NULL
    )
  )
$$;

-- 10. Index cho performance
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_branch_id ON public.audit_logs(branch_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_user_roles_branch_id ON public.user_roles(branch_id);