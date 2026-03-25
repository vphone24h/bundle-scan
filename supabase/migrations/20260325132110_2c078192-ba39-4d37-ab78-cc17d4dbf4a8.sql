-- Change quantity from integer to numeric(15,3) in products table (supports up to 10^12)
ALTER TABLE public.products ALTER COLUMN quantity TYPE numeric(15,3) USING quantity::numeric(15,3);
ALTER TABLE public.products ALTER COLUMN quantity SET DEFAULT 1;

-- Change quantity from integer to numeric(15,3) in product_imports table
ALTER TABLE public.product_imports ALTER COLUMN quantity TYPE numeric(15,3) USING quantity::numeric(15,3);
ALTER TABLE public.product_imports ALTER COLUMN quantity SET DEFAULT 1;