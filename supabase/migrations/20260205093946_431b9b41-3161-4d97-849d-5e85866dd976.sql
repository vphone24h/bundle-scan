-- Create storage bucket for tenant assets (used for tax policy images etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-assets', 
  'tenant-assets', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view public assets
CREATE POLICY "Public can view tenant assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-assets');

-- Allow platform admins to upload/manage assets
CREATE POLICY "Platform admins can upload tenant assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-assets' 
  AND EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = auth.uid()
    AND platform_role = 'platform_admin'
  )
);

CREATE POLICY "Platform admins can update tenant assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tenant-assets'
  AND EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = auth.uid()
    AND platform_role = 'platform_admin'
  )
);

CREATE POLICY "Platform admins can delete tenant assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tenant-assets'
  AND EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = auth.uid()
    AND platform_role = 'platform_admin'
  )
);