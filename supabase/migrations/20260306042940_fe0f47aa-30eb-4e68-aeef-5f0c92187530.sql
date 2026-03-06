ALTER TABLE public.import_returns 
ADD COLUMN fee_type text NOT NULL DEFAULT 'none',
ADD COLUMN fee_percentage numeric NOT NULL DEFAULT 0,
ADD COLUMN fee_amount numeric NOT NULL DEFAULT 0;