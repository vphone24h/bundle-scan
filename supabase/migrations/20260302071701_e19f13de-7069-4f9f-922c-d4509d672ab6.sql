-- Backfill original_debt_amount for ALL records using total_amount - paid_amount
-- This correctly captures the original debt regardless of FIFO payment status
UPDATE public.export_receipts 
SET original_debt_amount = GREATEST(total_amount - COALESCE(paid_amount, 0), 0)
WHERE original_debt_amount IS NULL OR original_debt_amount = 0;

UPDATE public.import_receipts 
SET original_debt_amount = GREATEST(total_amount - COALESCE(paid_amount, 0), 0)
WHERE original_debt_amount IS NULL OR original_debt_amount = 0;