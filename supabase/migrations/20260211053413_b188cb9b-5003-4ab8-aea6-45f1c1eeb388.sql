
-- Bảng đơn đặt hàng từ landing page
CREATE TABLE public.landing_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  product_image_url TEXT,
  product_price NUMERIC NOT NULL DEFAULT 0,
  variant TEXT, -- biến thể: màu sắc, dung lượng...
  quantity INTEGER NOT NULL DEFAULT 1,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_address TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'cancelled')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.landing_orders ENABLE ROW LEVEL SECURITY;

-- Public insert (anyone can place order)
CREATE POLICY "Anyone can place landing orders"
ON public.landing_orders
FOR INSERT
WITH CHECK (true);

-- Tenant members can view their orders
CREATE POLICY "Tenant members can view landing orders"
ON public.landing_orders
FOR SELECT
USING (public.user_belongs_to_tenant(tenant_id));

-- Admins can update orders (approve/cancel)
CREATE POLICY "Admins can update landing orders"
ON public.landing_orders
FOR UPDATE
USING (public.is_tenant_admin(auth.uid()) AND public.user_belongs_to_tenant(tenant_id));

-- Trigger for updated_at
CREATE TRIGGER update_landing_orders_updated_at
BEFORE UPDATE ON public.landing_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add variants/options field to landing_products
ALTER TABLE public.landing_products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]';
