
-- Thêm cột support_group_url vào bảng tenant_landing_settings
ALTER TABLE public.tenant_landing_settings 
ADD COLUMN IF NOT EXISTS support_group_url text;

COMMENT ON COLUMN public.tenant_landing_settings.support_group_url IS 'Link nhóm Zalo/Facebook/Telegram để hỗ trợ khách hàng';
