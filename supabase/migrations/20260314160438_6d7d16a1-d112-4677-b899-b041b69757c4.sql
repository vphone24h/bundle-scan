CREATE INDEX IF NOT EXISTS idx_customers_phone_prefix ON public.customers (phone text_pattern_ops);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON public.customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON public.customers (tenant_id);