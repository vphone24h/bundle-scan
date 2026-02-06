
-- =============================================
-- STOCK TRANSFER REQUEST SYSTEM
-- =============================================

-- Transfer request status enum
CREATE TYPE public.transfer_request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- Main transfer requests table
CREATE TABLE public.stock_transfer_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  from_branch_id UUID NOT NULL REFERENCES public.branches(id),
  to_branch_id UUID NOT NULL REFERENCES public.branches(id),
  status transfer_request_status NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL,
  approved_by UUID,
  note TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  reject_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT different_branches CHECK (from_branch_id != to_branch_id)
);

-- Transfer request items (individual products)
CREATE TABLE public.stock_transfer_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_request_id UUID NOT NULL REFERENCES public.stock_transfer_requests(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  imei TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  import_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock_transfer_requests
CREATE POLICY "Tenant users can view their transfer requests"
ON public.stock_transfer_requests
FOR SELECT
USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can create transfer requests"
ON public.stock_transfer_requests
FOR INSERT
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id) 
  AND public.is_tenant_admin(auth.uid())
);

CREATE POLICY "Tenant admins can update transfer requests"
ON public.stock_transfer_requests
FOR UPDATE
USING (
  public.user_belongs_to_tenant(tenant_id) 
  AND public.is_tenant_admin(auth.uid())
);

-- RLS policies for stock_transfer_items
CREATE POLICY "Users can view transfer items of their tenant"
ON public.stock_transfer_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.stock_transfer_requests r
    WHERE r.id = transfer_request_id
    AND public.user_belongs_to_tenant(r.tenant_id)
  )
);

CREATE POLICY "Admins can insert transfer items"
ON public.stock_transfer_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stock_transfer_requests r
    WHERE r.id = transfer_request_id
    AND public.user_belongs_to_tenant(r.tenant_id)
    AND public.is_tenant_admin(auth.uid())
  )
);

-- Indexes for performance
CREATE INDEX idx_transfer_requests_tenant ON public.stock_transfer_requests(tenant_id);
CREATE INDEX idx_transfer_requests_status ON public.stock_transfer_requests(status);
CREATE INDEX idx_transfer_requests_to_branch ON public.stock_transfer_requests(to_branch_id, status);
CREATE INDEX idx_transfer_items_request ON public.stock_transfer_items(transfer_request_id);

-- Trigger for updated_at
CREATE TRIGGER update_stock_transfer_requests_updated_at
BEFORE UPDATE ON public.stock_transfer_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
