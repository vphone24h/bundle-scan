
-- Drop old INSERT policy and recreate for both anon and authenticated
DROP POLICY IF EXISTS "Anyone can place landing orders" ON public.landing_orders;

CREATE POLICY "Anyone can place landing orders"
ON public.landing_orders
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
