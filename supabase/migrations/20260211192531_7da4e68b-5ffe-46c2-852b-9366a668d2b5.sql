
-- Drop existing overly-permissive anon policies
DROP POLICY IF EXISTS "Public can view tenant basics" ON public.tenants;
DROP POLICY IF EXISTS "Anyone can view public tenant info" ON public.tenants;
DROP POLICY IF EXISTS "Tenants are viewable by everyone" ON public.tenants;

-- Create NEW restricted policy for anonymous users - only essential columns
CREATE POLICY "Anon can view active tenants"
ON public.tenants
FOR SELECT
TO anon
USING (status IN ('trial', 'active'));
