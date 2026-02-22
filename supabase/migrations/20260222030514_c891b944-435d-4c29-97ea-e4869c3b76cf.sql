
-- Drop the overly permissive RLS policy on push_vapid_keys
DROP POLICY IF EXISTS "Authenticated users can read VAPID public key" ON public.push_vapid_keys;

-- Block all direct table access for non-service-role users
CREATE POLICY "No direct access to VAPID keys"
ON public.push_vapid_keys
FOR SELECT
USING (false);

-- Create a secure RPC that only returns the public key
CREATE OR REPLACE FUNCTION public.get_vapid_public_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _public_key TEXT;
BEGIN
  SELECT public_key INTO _public_key
  FROM public.push_vapid_keys
  LIMIT 1;
  RETURN _public_key;
END;
$$;

-- Grant execute to authenticated and anon (needed for subscription)
GRANT EXECUTE ON FUNCTION public.get_vapid_public_key() TO authenticated;
