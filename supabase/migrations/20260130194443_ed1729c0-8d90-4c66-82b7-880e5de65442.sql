
-- Thêm các cột social media vào bảng tenant_landing_settings
ALTER TABLE public.tenant_landing_settings 
ADD COLUMN IF NOT EXISTS facebook_url text,
ADD COLUMN IF NOT EXISTS zalo_url text,
ADD COLUMN IF NOT EXISTS tiktok_url text;

COMMENT ON COLUMN public.tenant_landing_settings.facebook_url IS 'Link trang Facebook';
COMMENT ON COLUMN public.tenant_landing_settings.zalo_url IS 'Link Zalo OA hoặc profile';
COMMENT ON COLUMN public.tenant_landing_settings.tiktok_url IS 'Link TikTok';
