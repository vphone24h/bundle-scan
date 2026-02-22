
CREATE OR REPLACE FUNCTION public.get_tenant_branches(_tenant_id uuid)
RETURNS TABLE(id uuid, name text, address text, phone text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT b.id, b.name, b.address, b.phone
  FROM branches b
  WHERE b.tenant_id = _tenant_id
  ORDER BY b.is_default DESC NULLS LAST, b.name ASC;
$$;
