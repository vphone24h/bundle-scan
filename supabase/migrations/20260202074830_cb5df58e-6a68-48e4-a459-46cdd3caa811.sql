-- Fix global unique constraint on customers.phone that blocks same phone across different tenants
-- 1) Remove the old global uniqueness
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_phone_key;
DROP INDEX IF EXISTS public.customers_phone_key;

-- 2) Enforce uniqueness per-tenant (only when tenant_id is present)
CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_id_phone_key
ON public.customers (tenant_id, phone)
WHERE tenant_id IS NOT NULL;