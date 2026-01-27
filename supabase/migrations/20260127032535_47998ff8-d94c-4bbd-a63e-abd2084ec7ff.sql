-- Fix linter: tránh policy WITH CHECK (true) trên affiliate_clicks
DROP POLICY IF EXISTS "Anyone can insert clicks" ON public.affiliate_clicks;

CREATE POLICY "Anyone can insert clicks"
ON public.affiliate_clicks
FOR INSERT
WITH CHECK (
  affiliate_id IS NOT NULL
);
