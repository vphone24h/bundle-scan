
-- =============================================
-- FIX 1: Prevent plaintext fallback in encrypt_api_key
-- =============================================
CREATE OR REPLACE FUNCTION public.encrypt_api_key(_plaintext text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _encryption_key text;
BEGIN
  _encryption_key := current_setting('app.einvoice_encryption_key', true);
  IF _encryption_key IS NULL OR _encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Set app.einvoice_encryption_key before storing API keys.';
  END IF;
  RETURN encode(pgp_sym_encrypt(_plaintext, _encryption_key), 'base64');
END;
$function$;

-- =============================================
-- FIX 2: Restrict anon access to tenants table
-- =============================================

-- Create a secure lookup function for subdomain resolution (anon)
CREATE OR REPLACE FUNCTION public.lookup_tenant_by_subdomain(_subdomain text)
RETURNS TABLE (
  id uuid,
  name text,
  subdomain text,
  status text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, t.subdomain, t.status::text
  FROM tenants t
  WHERE t.subdomain = _subdomain
    AND t.status IN ('active', 'trial')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_tenant_by_subdomain(text) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_tenant_by_subdomain(text) TO authenticated;

-- Drop the overly permissive anon policy
DROP POLICY IF EXISTS "Anon can view active tenants for routing" ON public.tenants;
DROP POLICY IF EXISTS "Public can view tenants by subdomain" ON public.tenants;
