-- Allow anonymous/public read of verified custom domains for tenant resolution
CREATE POLICY "Anyone can read verified custom_domains for routing"
ON public.custom_domains
FOR SELECT
USING (is_verified = true);
