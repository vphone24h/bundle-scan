-- Allow company_admin to SELECT tenants belonging to their company
CREATE POLICY "Company admins can view company tenants"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM platform_users pu
    WHERE pu.user_id = auth.uid()
    AND pu.platform_role = 'company_admin'
    AND pu.is_active = true
    AND pu.company_id = tenants.company_id
  )
);

-- Allow company_admin to UPDATE tenants belonging to their company
CREATE POLICY "Company admins can update company tenants"
ON public.tenants
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM platform_users pu
    WHERE pu.user_id = auth.uid()
    AND pu.platform_role = 'company_admin'
    AND pu.is_active = true
    AND pu.company_id = tenants.company_id
  )
);

-- Create storage bucket for company logos if not exists
INSERT INTO storage.buckets (id, name, public) VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view company assets
CREATE POLICY "Public can view company assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-assets');

-- Allow authenticated users to upload company assets
CREATE POLICY "Authenticated users can upload company assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-assets');

-- Allow authenticated users to update company assets
CREATE POLICY "Authenticated users can update company assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'company-assets');

-- Allow authenticated users to delete company assets
CREATE POLICY "Authenticated users can delete company assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'company-assets');