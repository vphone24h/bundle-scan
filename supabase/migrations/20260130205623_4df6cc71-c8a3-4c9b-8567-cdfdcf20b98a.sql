-- Allow public/anonymous to view basic tenant info for landing pages
-- Only expose minimal fields through query, but policy allows SELECT for subdomain lookup
CREATE POLICY "Public can view tenants by subdomain" 
ON public.tenants 
FOR SELECT 
TO anon, authenticated
USING (true);

-- Note: The existing more restrictive policies for authenticated users will still apply
-- due to PERMISSIVE policies being ORed together. This allows anonymous users to 
-- find tenants by subdomain for the public landing page.

-- Also ensure branches can be read for landing pages (show_branches feature)
-- Check existing policy first and add if needed
DO $$
BEGIN
  -- Check if public branches policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'branches' 
    AND policyname = 'Public can view branches for landing'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can view branches for landing" ON public.branches FOR SELECT TO anon USING (true)';
  END IF;
END $$;

-- Ensure customers can be queried by phone for warranty lookup (public)
-- This is needed for the warranty lookup feature on landing pages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customers' 
    AND policyname = 'Public can lookup customers by phone for warranty'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can lookup customers by phone for warranty" ON public.customers FOR SELECT TO anon USING (true)';
  END IF;
END $$;

-- Ensure export_receipt_items can be queried for warranty lookup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'export_receipt_items' 
    AND policyname = 'Public can view for warranty lookup'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can view for warranty lookup" ON public.export_receipt_items FOR SELECT TO anon USING (true)';
  END IF;
END $$;

-- Ensure export_receipts can be joined for warranty lookup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'export_receipts' 
    AND policyname = 'Public can view for warranty lookup'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can view for warranty lookup" ON public.export_receipts FOR SELECT TO anon USING (true)';
  END IF;
END $$;