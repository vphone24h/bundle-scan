
-- Add INSERT policy for debt_tags
CREATE POLICY "Users can insert debt_tags for their tenant"
ON public.debt_tags
FOR INSERT
WITH CHECK (tenant_id = public.get_user_tenant_id_secure()::text);

-- Add INSERT policy for debt_tag_assignments
CREATE POLICY "Users can insert debt_tag_assignments for their tenant"
ON public.debt_tag_assignments
FOR INSERT
WITH CHECK (tenant_id = public.get_user_tenant_id_secure()::text);

-- Add DELETE policy for debt_tags
CREATE POLICY "Users can delete debt_tags for their tenant"
ON public.debt_tags
FOR DELETE
USING (tenant_id = public.get_user_tenant_id_secure()::text);

-- Add DELETE policy for debt_tag_assignments
CREATE POLICY "Users can delete debt_tag_assignments for their tenant"
ON public.debt_tag_assignments
FOR DELETE
USING (tenant_id = public.get_user_tenant_id_secure()::text);

-- Add SELECT policy for debt_tags
CREATE POLICY "Users can view debt_tags for their tenant"
ON public.debt_tags
FOR SELECT
USING (tenant_id = public.get_user_tenant_id_secure()::text);

-- Add SELECT policy for debt_tag_assignments
CREATE POLICY "Users can view debt_tag_assignments for their tenant"
ON public.debt_tag_assignments
FOR SELECT
USING (tenant_id = public.get_user_tenant_id_secure()::text);
