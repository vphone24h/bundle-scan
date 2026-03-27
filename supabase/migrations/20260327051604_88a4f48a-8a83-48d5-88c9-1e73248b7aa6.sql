
CREATE OR REPLACE FUNCTION public.check_tenant_unique_field(
  _field TEXT,
  _value TEXT,
  _exclude_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants
    WHERE 
      CASE 
        WHEN _field = 'subdomain' THEN subdomain = _value
        WHEN _field = 'email' THEN email = _value
        ELSE FALSE
      END
      AND id != _exclude_tenant_id
  )
$$;
