-- Tạo storage bucket cho landing page assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-assets', 'landing-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policy cho phép authenticated users upload
CREATE POLICY "Authenticated users can upload landing assets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'landing-assets' 
  AND auth.role() = 'authenticated'
);

-- Policy cho phép public view
CREATE POLICY "Public can view landing assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'landing-assets');

-- Policy cho phép authenticated users update/delete own files
CREATE POLICY "Authenticated users can manage landing assets"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'landing-assets' 
  AND auth.role() = 'authenticated'
);

-- Thêm cột warranty_hotline vào tenant_landing_settings
ALTER TABLE public.tenant_landing_settings
ADD COLUMN IF NOT EXISTS warranty_hotline TEXT;