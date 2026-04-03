
CREATE OR REPLACE FUNCTION public.verify_security_password_hash(p_hash text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.security_passwords sp
    JOIN public.platform_users pu ON pu.tenant_id = sp.tenant_id
    WHERE pu.user_id = auth.uid()
      AND sp.password_hash = p_hash
  );
$$;
