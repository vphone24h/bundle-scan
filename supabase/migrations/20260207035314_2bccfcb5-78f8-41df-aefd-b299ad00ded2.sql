
-- Bảng lưu quyền xem chi nhánh bổ sung cho user (ngoài chi nhánh được gán chính)
CREATE TABLE public.user_branch_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  granted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, branch_id)
);

-- Enable RLS
ALTER TABLE public.user_branch_access ENABLE ROW LEVEL SECURITY;

-- Super Admin và Branch Admin cùng tenant có thể xem
CREATE POLICY "Tenant users can view branch access"
  ON public.user_branch_access
  FOR SELECT
  USING (public.user_belongs_to_tenant(tenant_id));

-- Chỉ Super Admin (tenant admin) mới có thể thêm/sửa/xóa
CREATE POLICY "Tenant admin can manage branch access"
  ON public.user_branch_access
  FOR INSERT
  WITH CHECK (
    public.user_belongs_to_tenant(tenant_id)
    AND public.is_tenant_admin(auth.uid())
  );

CREATE POLICY "Tenant admin can delete branch access"
  ON public.user_branch_access
  FOR DELETE
  USING (
    public.user_belongs_to_tenant(tenant_id)
    AND public.is_tenant_admin(auth.uid())
  );

-- Index cho performance
CREATE INDEX idx_user_branch_access_user_id ON public.user_branch_access(user_id);
CREATE INDEX idx_user_branch_access_tenant_id ON public.user_branch_access(tenant_id);

-- Function để lấy tất cả branch_id mà user được phép xem (bao gồm branch chính + bổ sung)
CREATE OR REPLACE FUNCTION public.get_user_accessible_branch_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT bid),
    ARRAY[]::uuid[]
  )
  FROM (
    -- Chi nhánh chính được gán
    SELECT branch_id AS bid FROM public.user_roles WHERE user_id = _user_id AND branch_id IS NOT NULL
    UNION
    -- Chi nhánh bổ sung được cấp quyền
    SELECT branch_id AS bid FROM public.user_branch_access WHERE user_id = _user_id
  ) sub
$$;
