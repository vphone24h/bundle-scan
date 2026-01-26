-- Drop the existing update policy
DROP POLICY IF EXISTS "Authenticated users can update draft stock counts" ON public.stock_counts;

-- Create new policy that allows updating draft records (USING checks old row, WITH CHECK allows new state)
CREATE POLICY "Authenticated users can update draft stock counts"
ON public.stock_counts FOR UPDATE
USING (is_authenticated() AND status = 'draft')
WITH CHECK (is_authenticated());

-- Also add policy to allow admins to update confirmed records for edge cases
CREATE POLICY "Admins can update confirmed stock counts"
ON public.stock_counts FOR UPDATE
USING (is_authenticated() AND status = 'confirmed' AND has_role(auth.uid(), 'admin'))
WITH CHECK (is_authenticated() AND has_role(auth.uid(), 'admin'));