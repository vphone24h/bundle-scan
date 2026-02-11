
-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Public can view branches for landing pages" ON public.branches;

-- Recreate: allow anon (not logged in) to view all branches (for landing/order forms)
-- Logged-in users already have their own tenant-scoped policy
CREATE POLICY "Anon can view branches for landing pages"
ON public.branches
FOR SELECT
TO anon
USING (true);
