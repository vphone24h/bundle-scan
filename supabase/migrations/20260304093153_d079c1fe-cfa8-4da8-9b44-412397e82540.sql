-- Allow anon to SELECT their own just-inserted order (needed for INSERT...RETURNING)
CREATE POLICY "Anon can read own inserted orders"
ON public.landing_orders
FOR SELECT
TO anon
USING (true);
