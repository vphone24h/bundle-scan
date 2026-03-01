-- Allow authenticated users to read basic profile info for social features
CREATE POLICY "Authenticated users can view basic profiles for social"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);