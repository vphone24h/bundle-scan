
-- Enable pg_trgm extension first
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes for text search
CREATE INDEX IF NOT EXISTS idx_products_name_gin 
  ON public.products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_name_gin 
  ON public.customers USING gin (name gin_trgm_ops);
