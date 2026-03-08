
CREATE POLICY "Authenticated can read own inserted orders"
ON public.landing_orders
FOR SELECT
TO authenticated
USING (true);
