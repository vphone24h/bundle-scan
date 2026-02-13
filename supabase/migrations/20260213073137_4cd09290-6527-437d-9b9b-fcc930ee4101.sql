
-- Add is_printed column to products table
ALTER TABLE public.products ADD COLUMN is_printed boolean NOT NULL DEFAULT false;

-- Add index for filtering
CREATE INDEX idx_products_is_printed ON public.products (is_printed);
