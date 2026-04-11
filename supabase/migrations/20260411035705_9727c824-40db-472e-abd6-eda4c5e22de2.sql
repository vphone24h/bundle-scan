-- Drop old unique constraint on config_key only
ALTER TABLE public.payment_config DROP CONSTRAINT IF EXISTS payment_config_config_key_key;

-- Create unique index that supports NULL company_id  
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_config_key_company 
ON public.payment_config (config_key, company_id);

-- For rows where company_id IS NULL, ensure uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_config_key_null_company 
ON public.payment_config (config_key) WHERE company_id IS NULL;