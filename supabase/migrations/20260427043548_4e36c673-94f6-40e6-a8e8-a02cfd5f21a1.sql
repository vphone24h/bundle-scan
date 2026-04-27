-- Remove overly permissive policies that leak categories across tenants
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON public.cash_book_categories;
DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.cash_book_categories;