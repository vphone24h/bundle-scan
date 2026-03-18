-- Allow richer image uploads for editor content (mobile HEIC + larger photos)
UPDATE storage.buckets
SET
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/avif'
  ]
WHERE id = 'tenant-assets';

-- Allow authenticated users to upload editor images in tenant-assets/editor/*
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload editor images'
  ) THEN
    CREATE POLICY "Authenticated users can upload editor images"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'tenant-assets'
      AND (storage.foldername(name))[1] = 'editor'
    );
  END IF;
END
$$;

-- Optional management for editor images created by authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can update editor images'
  ) THEN
    CREATE POLICY "Authenticated users can update editor images"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'tenant-assets'
      AND (storage.foldername(name))[1] = 'editor'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can delete editor images'
  ) THEN
    CREATE POLICY "Authenticated users can delete editor images"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'tenant-assets'
      AND (storage.foldername(name))[1] = 'editor'
    );
  END IF;
END
$$;