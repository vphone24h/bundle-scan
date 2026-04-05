
-- Add tenant_id to cash_book_categories
ALTER TABLE public.cash_book_categories 
ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);

-- Assign non-default categories to vphone1 tenant (existing custom data)
UPDATE public.cash_book_categories 
SET tenant_id = '66a834a2-6826-4cf6-8ce6-e5ceabce2780' 
WHERE is_default = false;

-- Default categories get NULL tenant_id (shared across all stores)
-- They stay as-is (tenant_id = NULL)

-- Create index
CREATE INDEX idx_cash_book_categories_tenant ON public.cash_book_categories(tenant_id);

-- Enable RLS
ALTER TABLE public.cash_book_categories ENABLE ROW LEVEL SECURITY;

-- Users can see default categories (tenant_id IS NULL) + their own tenant's categories
CREATE POLICY "Users can view own and default categories"
ON public.cash_book_categories FOR SELECT
TO authenticated
USING (
  tenant_id IS NULL 
  OR tenant_id = (SELECT public.get_user_tenant_id_secure())
);

-- Users can create categories for their own tenant
CREATE POLICY "Users can create own categories"
ON public.cash_book_categories FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (SELECT public.get_user_tenant_id_secure())
);

-- Users can update their own tenant's categories (not default ones)
CREATE POLICY "Users can update own categories"
ON public.cash_book_categories FOR UPDATE
TO authenticated
USING (
  tenant_id IS NOT NULL 
  AND tenant_id = (SELECT public.get_user_tenant_id_secure())
);

-- Users can delete their own tenant's categories (not default ones)
CREATE POLICY "Users can delete own categories"
ON public.cash_book_categories FOR DELETE
TO authenticated
USING (
  tenant_id IS NOT NULL 
  AND tenant_id = (SELECT public.get_user_tenant_id_secure())
);
