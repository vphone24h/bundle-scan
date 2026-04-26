-- Bảng cọc khách hàng cho sản phẩm cụ thể
CREATE TABLE public.product_deposits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  branch_id UUID,
  product_id UUID NOT NULL,
  customer_id UUID,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  deposit_amount NUMERIC NOT NULL DEFAULT 0,
  payment_source TEXT NOT NULL DEFAULT 'cash',
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active | applied | refunded
  applied_receipt_id UUID, -- export_receipt khi áp dụng
  refund_cash_book_id UUID,
  cash_book_id UUID,
  created_by UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);

CREATE INDEX idx_product_deposits_product ON public.product_deposits(product_id) WHERE status = 'active';
CREATE INDEX idx_product_deposits_tenant ON public.product_deposits(tenant_id);
CREATE INDEX idx_product_deposits_customer ON public.product_deposits(customer_id);

ALTER TABLE public.product_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view deposits"
ON public.product_deposits FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant_id_secure());

CREATE POLICY "Tenant members can insert deposits"
ON public.product_deposits FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id_secure());

CREATE POLICY "Tenant members can update deposits"
ON public.product_deposits FOR UPDATE TO authenticated
USING (tenant_id = public.get_user_tenant_id_secure());

CREATE POLICY "Tenant members can delete deposits"
ON public.product_deposits FOR DELETE TO authenticated
USING (tenant_id = public.get_user_tenant_id_secure());

CREATE TRIGGER trg_product_deposits_updated_at
BEFORE UPDATE ON public.product_deposits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();