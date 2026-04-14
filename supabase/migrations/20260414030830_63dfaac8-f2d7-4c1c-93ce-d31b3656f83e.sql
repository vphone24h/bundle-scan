CREATE POLICY "Authenticated users can upload print template images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] = 'print-templates'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can update print template images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] = 'print-templates'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can delete print template images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] = 'print-templates'
  AND auth.uid() IS NOT NULL
);