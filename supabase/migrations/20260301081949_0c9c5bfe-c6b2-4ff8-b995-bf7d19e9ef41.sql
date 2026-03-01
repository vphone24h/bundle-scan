-- Allow authenticated users to upload social images
CREATE POLICY "Users can upload social images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'social'
);

-- Allow users to update their own social images
CREATE POLICY "Users can update own social images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'tenant-assets'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'social'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow users to delete their own social images
CREATE POLICY "Users can delete own social images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'tenant-assets'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'social'
  AND (storage.foldername(name))[2] = auth.uid()::text
);