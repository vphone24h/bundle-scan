
-- 1) Bảng gói dịch vụ sản phẩm (VD: gói bảo hành VIP, gói massage thêm 15P...)
CREATE TABLE public.product_service_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_group_id UUID REFERENCES public.product_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX idx_product_service_packages_tenant ON public.product_service_packages(tenant_id);
CREATE INDEX idx_product_service_packages_group ON public.product_service_packages(product_group_id);

-- RLS
ALTER TABLE public.product_service_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view service packages of their tenant"
ON public.product_service_packages FOR SELECT
TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage service packages of their tenant"
ON public.product_service_packages FOR ALL
TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()))
WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- 2) Bảng gói dịch vụ đã chọn trong đơn hàng xuất
CREATE TABLE public.export_receipt_service_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES public.export_receipts(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.product_service_packages(id) ON DELETE SET NULL,
  package_name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_export_receipt_sp_receipt ON public.export_receipt_service_packages(receipt_id);

ALTER TABLE public.export_receipt_service_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view receipt service packages"
ON public.export_receipt_service_packages FOR SELECT
TO authenticated
USING (receipt_id IN (SELECT id FROM public.export_receipts WHERE tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())));

CREATE POLICY "Users can manage receipt service packages"
ON public.export_receipt_service_packages FOR ALL
TO authenticated
USING (receipt_id IN (SELECT id FROM public.export_receipts WHERE tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())))
WITH CHECK (receipt_id IN (SELECT id FROM public.export_receipts WHERE tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())));

-- 3) Thêm cột service_package_total vào export_receipts để lưu tổng tiền gói dịch vụ
ALTER TABLE public.export_receipts ADD COLUMN IF NOT EXISTS service_package_total NUMERIC DEFAULT 0;

-- 4) Trigger updated_at
CREATE TRIGGER update_product_service_packages_updated_at
BEFORE UPDATE ON public.product_service_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
