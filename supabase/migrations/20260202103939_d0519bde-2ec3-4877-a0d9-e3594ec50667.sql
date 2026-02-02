-- Add column for custom description image
ALTER TABLE public.invoice_templates 
ADD COLUMN IF NOT EXISTS custom_description_image_url TEXT DEFAULT NULL;

-- Create storage bucket for invoice template assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-assets', 'invoice-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to invoice-assets bucket
CREATE POLICY "Authenticated users can upload invoice assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invoice-assets' AND auth.role() = 'authenticated');

-- Allow public to view invoice assets
CREATE POLICY "Public can view invoice assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoice-assets');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update invoice assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'invoice-assets' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete invoice assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'invoice-assets' AND auth.role() = 'authenticated');