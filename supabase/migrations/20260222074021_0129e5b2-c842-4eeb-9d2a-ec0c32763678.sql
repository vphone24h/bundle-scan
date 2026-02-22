CREATE OR REPLACE FUNCTION public.lookup_tenant_by_id(_tenant_id uuid)
 RETURNS TABLE(id uuid, name text, subdomain text, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT t.id, t.name, t.subdomain, t.status::text
  FROM tenants t
  WHERE t.id = _tenant_id
    AND t.status IN ('active', 'trial')
  LIMIT 1;
$$;