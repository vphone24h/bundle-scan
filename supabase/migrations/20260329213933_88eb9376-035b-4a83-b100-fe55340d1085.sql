
CREATE OR REPLACE FUNCTION public.check_tenant_has_security_password()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM security_passwords sp
    JOIN user_roles ur ON ur.tenant_id = sp.tenant_id
    WHERE ur.user_id = auth.uid()
  )
$$;
