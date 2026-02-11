
-- Fix search_path for the new function
CREATE OR REPLACE FUNCTION public.get_tenant_enrichment()
RETURNS TABLE(
  tenant_id uuid,
  has_landing_enabled boolean,
  landing_domain text,
  has_usage boolean
)
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id AS tenant_id,
    COALESCE(ls.is_enabled, false) AS has_landing_enabled,
    COALESCE(cd.domain, t.subdomain || '.vkho.vn') AS landing_domain,
    (
      EXISTS (SELECT 1 FROM public.import_receipts ir WHERE ir.tenant_id = t.id LIMIT 1)
      OR EXISTS (SELECT 1 FROM public.export_receipts er WHERE er.tenant_id = t.id LIMIT 1)
    ) AS has_usage
  FROM public.tenants t
  LEFT JOIN public.tenant_landing_settings ls ON ls.tenant_id = t.id
  LEFT JOIN public.custom_domains cd ON cd.tenant_id = t.id AND cd.is_verified = true
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
