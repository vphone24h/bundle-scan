-- Create storage bucket for minigame prize images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'minigame-assets',
  'minigame-assets',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for minigame-assets bucket
CREATE POLICY "Public can view minigame assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'minigame-assets');

CREATE POLICY "Authenticated users can upload minigame assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'minigame-assets');

CREATE POLICY "Users can update own minigame assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'minigame-assets');

CREATE POLICY "Users can delete own minigame assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'minigame-assets');

-- Add description and claim_link columns to minigame_prizes if they don't exist
ALTER TABLE public.minigame_prizes 
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS claim_link text;