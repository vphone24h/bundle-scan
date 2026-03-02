
-- Add allocated_amount column to debt_payments table
-- This tracks how much of an addition note has been paid off via subsequent payments
ALTER TABLE public.debt_payments 
ADD COLUMN IF NOT EXISTS allocated_amount numeric DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.debt_payments.allocated_amount IS 'For addition entries: how much of this addition has been paid off. For payment entries: not used.';
