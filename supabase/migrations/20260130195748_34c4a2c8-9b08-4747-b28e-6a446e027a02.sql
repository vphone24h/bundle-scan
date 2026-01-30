-- Add show_branches field to tenant_landing_settings
ALTER TABLE public.tenant_landing_settings
ADD COLUMN IF NOT EXISTS show_branches boolean NOT NULL DEFAULT true;

-- Add comment
COMMENT ON COLUMN public.tenant_landing_settings.show_branches IS 'Hiển thị danh sách chi nhánh trên landing page';