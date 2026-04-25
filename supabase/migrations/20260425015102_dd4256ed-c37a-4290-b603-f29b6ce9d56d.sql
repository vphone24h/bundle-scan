CREATE OR REPLACE FUNCTION public.resolve_tenant_by_domain_full(_domain text)
RETURNS TABLE(id uuid, name text, subdomain text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH resolved AS (
    SELECT tenant_id AS tid FROM public.custom_domains
    WHERE domain = _domain AND is_verified = true
    UNION ALL
    SELECT t.id FROM public.tenants t
    WHERE t.subdomain = split_part(_domain, '.', 1)
    LIMIT 1
  )
  SELECT t.id, t.name, t.subdomain, t.status
  FROM public.tenants t
  JOIN resolved r ON r.tid = t.id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_tenant_by_domain_full(text) TO anon, authenticated;