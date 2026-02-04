-- Drop existing SELECT policy và tạo policy chặt hơn
DROP POLICY IF EXISTS "Users can view branches of their tenant" ON public.branches;

-- Tạo policy mới yêu cầu tenant_id NOT NULL
CREATE POLICY "Users can view branches of their tenant"
ON public.branches
FOR SELECT
USING (
  tenant_id IS NOT NULL 
  AND public.user_belongs_to_tenant(tenant_id)
);