-- Allow public read of branches for landing page order forms
CREATE POLICY "Public can view branches for landing pages"
ON public.branches
FOR SELECT
USING (true);
