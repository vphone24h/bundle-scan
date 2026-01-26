-- Add tenant_id column to return_payments table
ALTER TABLE public.return_payments 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- Enable RLS on return_payments
ALTER TABLE public.return_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for return_payments
DROP POLICY IF EXISTS "Users can manage own tenant return_payments" ON public.return_payments;
CREATE POLICY "Users can manage own tenant return_payments"
ON public.return_payments FOR ALL
USING (
  is_platform_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id_secure()
);

DROP POLICY IF EXISTS "Users can view own tenant return_payments" ON public.return_payments;
CREATE POLICY "Users can view own tenant return_payments"
ON public.return_payments FOR SELECT
USING (
  is_platform_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id_secure()
);