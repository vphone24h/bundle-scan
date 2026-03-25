-- Add unit column to products (default 'cái' for existing products)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'cái';