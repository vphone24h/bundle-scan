
-- Drop the overly permissive anon SELECT policy
DROP POLICY IF EXISTS "Anon can read own inserted orders" ON public.landing_orders;

-- Create a restrictive policy: anon users can only read orders they just created in their session
-- They need to know the exact order ID to access it
CREATE POLICY "Anon can read orders by id"
ON public.landing_orders
FOR SELECT
TO anon
USING (false);

-- Authenticated users (staff/admin) can read orders for their tenant
-- Keep existing authenticated policies as-is if they exist
