
-- Table lưu số dư đầu kỳ cho từng nguồn tiền
CREATE TABLE public.cash_book_opening_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payment_source TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  period_type TEXT NOT NULL DEFAULT 'custom', -- 'month', 'quarter', 'year', 'custom'
  period_start DATE NOT NULL,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Mỗi tenant chỉ có 1 opening balance cho mỗi nguồn tiền + mỗi kỳ
  UNIQUE(tenant_id, payment_source, period_start)
);

-- Enable RLS
ALTER TABLE public.cash_book_opening_balances ENABLE ROW LEVEL SECURITY;

-- Policies: chỉ admin mới có quyền quản lý
CREATE POLICY "Tenant users can view opening balances"
ON public.cash_book_opening_balances
FOR SELECT
USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can insert opening balances"
ON public.cash_book_opening_balances
FOR INSERT
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.is_tenant_admin(auth.uid())
);

CREATE POLICY "Tenant admins can update opening balances"
ON public.cash_book_opening_balances
FOR UPDATE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.is_tenant_admin(auth.uid())
);

CREATE POLICY "Tenant admins can delete opening balances"
ON public.cash_book_opening_balances
FOR DELETE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.is_tenant_admin(auth.uid())
);

-- Trigger auto-update updated_at
CREATE TRIGGER update_cash_book_opening_balances_updated_at
BEFORE UPDATE ON public.cash_book_opening_balances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
