
-- Add business_mode column to tenants table
-- 'public' = full features, 'secret' = hide tax/einvoice features
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS business_mode text NOT NULL DEFAULT 'public';

-- Add comment
COMMENT ON COLUMN public.tenants.business_mode IS 'Business visibility mode: public (full features) or secret (hide tax/einvoice)';
