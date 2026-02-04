-- Safe branch delete function: prevents deleting default branch and branches still referenced by business data
CREATE OR REPLACE FUNCTION public.delete_branch_safe(_branch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _is_default boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  _tenant_id := public.get_user_tenant_id_secure();
  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND';
  END IF;

  -- Must be platform admin or tenant admin
  IF NOT (public.is_platform_admin(auth.uid()) OR public.is_tenant_admin(auth.uid())) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Ensure branch belongs to current tenant
  SELECT b.is_default INTO _is_default
  FROM public.branches b
  WHERE b.id = _branch_id
    AND b.tenant_id = _tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BRANCH_NOT_FOUND';
  END IF;

  IF COALESCE(_is_default, false) = true THEN
    RAISE EXCEPTION 'CANNOT_DELETE_DEFAULT_BRANCH';
  END IF;

  -- Block deletion if referenced anywhere important
  IF EXISTS (SELECT 1 FROM public.products p WHERE p.branch_id = _branch_id LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.import_receipts ir WHERE ir.branch_id = _branch_id LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.export_receipts er WHERE er.branch_id = _branch_id LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.cash_book cb WHERE cb.branch_id = _branch_id LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.customers c WHERE c.preferred_branch_id = _branch_id LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.debt_payments dp WHERE dp.branch_id = _branch_id LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.audit_logs al WHERE al.branch_id = _branch_id LIMIT 1)
  THEN
    RAISE EXCEPTION 'BRANCH_IN_USE';
  END IF;

  DELETE FROM public.branches
  WHERE id = _branch_id
    AND tenant_id = _tenant_id;
END;
$$;

-- Allow authenticated users to call the function (authorization is inside the function)
GRANT EXECUTE ON FUNCTION public.delete_branch_safe(uuid) TO authenticated;