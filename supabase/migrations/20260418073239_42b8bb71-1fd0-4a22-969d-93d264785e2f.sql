CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH platform_scope AS (
    SELECT pu.company_id, pu.tenant_id
    FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
      AND pu.is_active = true
    ORDER BY CASE WHEN pu.company_id IS NOT NULL THEN 0 WHEN pu.tenant_id IS NOT NULL THEN 1 ELSE 2 END
    LIMIT 1
  ),
  role_scope AS (
    SELECT ur.tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id IS NOT NULL
    LIMIT 1
  )
  SELECT COALESCE(
    (SELECT ps.company_id FROM platform_scope ps WHERE ps.company_id IS NOT NULL LIMIT 1),
    (
      SELECT t.company_id
      FROM platform_scope ps
      JOIN public.tenants t ON t.id = ps.tenant_id
      WHERE ps.tenant_id IS NOT NULL
      LIMIT 1
    ),
    (
      SELECT t.company_id
      FROM role_scope rs
      JOIN public.tenants t ON t.id = rs.tenant_id
      LIMIT 1
    )
  );
$$;