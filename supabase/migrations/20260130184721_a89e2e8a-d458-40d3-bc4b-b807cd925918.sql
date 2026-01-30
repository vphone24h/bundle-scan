-- Bảng cấu hình landing page cho mỗi tenant
CREATE TABLE public.tenant_landing_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Thông tin cửa hàng hiển thị
  store_name TEXT,
  store_logo_url TEXT,
  store_address TEXT,
  store_phone TEXT,
  store_email TEXT,
  store_description TEXT,
  
  -- Banner/Quảng cáo
  banner_image_url TEXT,
  banner_link_url TEXT,
  
  -- Bật/tắt các tính năng
  show_warranty_lookup BOOLEAN DEFAULT true,
  show_store_info BOOLEAN DEFAULT true,
  show_banner BOOLEAN DEFAULT false,
  
  -- Màu sắc tùy chỉnh
  primary_color TEXT DEFAULT '#0f766e',
  
  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  
  -- Trạng thái
  is_enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_tenant_landing UNIQUE (tenant_id)
);

-- Enable RLS
ALTER TABLE public.tenant_landing_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Công khai đọc nếu landing page được bật
CREATE POLICY "Public can view enabled landing settings"
ON public.tenant_landing_settings
FOR SELECT
USING (is_enabled = true);

-- Policy: Admin cửa hàng có thể quản lý
CREATE POLICY "Tenant admins can manage landing settings"
ON public.tenant_landing_settings
FOR ALL
USING (
  is_platform_admin(auth.uid()) 
  OR (
    tenant_id = get_user_tenant_id_secure() 
    AND get_user_role(auth.uid()) IN ('super_admin', 'branch_admin')
  )
);

-- Trigger cập nhật updated_at
CREATE TRIGGER update_tenant_landing_settings_updated_at
BEFORE UPDATE ON public.tenant_landing_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();