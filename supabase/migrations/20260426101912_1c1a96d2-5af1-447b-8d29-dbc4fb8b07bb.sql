
-- ============================================================
-- PREORDER (Đặt hàng trước / Cọc) System
-- ============================================================

-- 1. Bảng phiếu cọc
CREATE TABLE public.preorder_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  preorder_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  customer_id UUID,
  branch_id UUID,
  sales_staff_id UUID,
  tenant_id UUID,
  
  -- Tài chính
  total_amount NUMERIC NOT NULL DEFAULT 0,        -- Tổng giá trị sản phẩm (giá bán dự kiến)
  deposit_amount NUMERIC NOT NULL DEFAULT 0,      -- Số tiền cọc đã nhận
  remaining_amount NUMERIC NOT NULL DEFAULT 0,    -- Số tiền còn lại khách phải trả
  deposit_payment_source TEXT,                    -- Nguồn tiền nhận cọc: cash, bank, debt, ... (NULL = ghi nợ)
  
  -- Trạng thái
  -- pending: đang giữ chỗ, chờ khách lấy
  -- completed: khách đã lấy hàng (đã tạo export_receipt)
  -- cancelled_full_refund: hủy, trả 100% cọc
  -- cancelled_partial_refund: hủy, giữ lại 1 phần
  -- cancelled_keep_all: hủy, giữ toàn bộ cọc
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Liên kết khi hoàn thành
  export_receipt_id UUID,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Hủy cọc
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancel_reason TEXT,
  refund_amount NUMERIC DEFAULT 0,         -- Số tiền hoàn trả khách
  kept_amount NUMERIC DEFAULT 0,           -- Số tiền cửa hàng giữ lại (= thu nhập khác)
  refund_payment_source TEXT,              -- Nguồn tiền hoàn trả
  cancelled_by UUID,
  
  note TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_preorder_receipts_tenant ON public.preorder_receipts(tenant_id);
CREATE INDEX idx_preorder_receipts_customer ON public.preorder_receipts(customer_id);
CREATE INDEX idx_preorder_receipts_status ON public.preorder_receipts(status);
CREATE INDEX idx_preorder_receipts_branch ON public.preorder_receipts(branch_id);
CREATE INDEX idx_preorder_receipts_date ON public.preorder_receipts(preorder_date DESC);

-- 2. Bảng chi tiết sản phẩm trong phiếu cọc
CREATE TABLE public.preorder_receipt_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  preorder_id UUID NOT NULL REFERENCES public.preorder_receipts(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  imei TEXT,
  category_id UUID,
  sale_price NUMERIC NOT NULL DEFAULT 0,
  quantity NUMERIC DEFAULT 1,
  unit TEXT,
  warranty TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_preorder_items_preorder ON public.preorder_receipt_items(preorder_id);
CREATE INDEX idx_preorder_items_product ON public.preorder_receipt_items(product_id);
CREATE INDEX idx_preorder_items_imei ON public.preorder_receipt_items(imei);

-- 3. Bảng giữ chỗ IMEI (để truy vấn nhanh khi bán/cọc tiếp)
-- Chỉ chứa các reservation đang ACTIVE (status preorder = pending)
CREATE TABLE public.preorder_imei_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  preorder_id UUID NOT NULL REFERENCES public.preorder_receipts(id) ON DELETE CASCADE,
  product_id UUID,
  imei TEXT NOT NULL,
  branch_id UUID,
  tenant_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(imei, tenant_id)  -- 1 IMEI chỉ được reserve trong 1 phiếu cọc active
);

CREATE INDEX idx_preorder_reserved_imei ON public.preorder_imei_reservations(imei);
CREATE INDEX idx_preorder_reserved_tenant ON public.preorder_imei_reservations(tenant_id);
CREATE INDEX idx_preorder_reserved_preorder ON public.preorder_imei_reservations(preorder_id);

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE public.preorder_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preorder_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preorder_imei_reservations ENABLE ROW LEVEL SECURITY;

-- preorder_receipts
CREATE POLICY "Users can view preorders in their tenant"
ON public.preorder_receipts FOR SELECT
USING (tenant_id = public.get_user_tenant_id_secure());

CREATE POLICY "Users can create preorders in their tenant"
ON public.preorder_receipts FOR INSERT
WITH CHECK (tenant_id = public.get_user_tenant_id_secure());

CREATE POLICY "Users can update preorders in their tenant"
ON public.preorder_receipts FOR UPDATE
USING (tenant_id = public.get_user_tenant_id_secure());

CREATE POLICY "Users can delete preorders in their tenant"
ON public.preorder_receipts FOR DELETE
USING (tenant_id = public.get_user_tenant_id_secure());

-- preorder_receipt_items (qua preorder_id)
CREATE POLICY "Users can view preorder items in their tenant"
ON public.preorder_receipt_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.preorder_receipts pr
  WHERE pr.id = preorder_receipt_items.preorder_id
    AND pr.tenant_id = public.get_user_tenant_id_secure()
));

CREATE POLICY "Users can create preorder items in their tenant"
ON public.preorder_receipt_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.preorder_receipts pr
  WHERE pr.id = preorder_receipt_items.preorder_id
    AND pr.tenant_id = public.get_user_tenant_id_secure()
));

CREATE POLICY "Users can update preorder items in their tenant"
ON public.preorder_receipt_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.preorder_receipts pr
  WHERE pr.id = preorder_receipt_items.preorder_id
    AND pr.tenant_id = public.get_user_tenant_id_secure()
));

CREATE POLICY "Users can delete preorder items in their tenant"
ON public.preorder_receipt_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.preorder_receipts pr
  WHERE pr.id = preorder_receipt_items.preorder_id
    AND pr.tenant_id = public.get_user_tenant_id_secure()
));

-- preorder_imei_reservations
CREATE POLICY "Users can view reservations in their tenant"
ON public.preorder_imei_reservations FOR SELECT
USING (tenant_id = public.get_user_tenant_id_secure());

CREATE POLICY "Users can create reservations in their tenant"
ON public.preorder_imei_reservations FOR INSERT
WITH CHECK (tenant_id = public.get_user_tenant_id_secure());

CREATE POLICY "Users can delete reservations in their tenant"
ON public.preorder_imei_reservations FOR DELETE
USING (tenant_id = public.get_user_tenant_id_secure());

-- ============================================================
-- Trigger updated_at
-- ============================================================
CREATE TRIGGER update_preorder_receipts_updated_at
BEFORE UPDATE ON public.preorder_receipts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
