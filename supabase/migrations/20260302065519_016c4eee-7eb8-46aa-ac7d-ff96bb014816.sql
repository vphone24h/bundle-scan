
-- Add original_debt_amount to track the initial debt when receipt was created
ALTER TABLE public.export_receipts ADD COLUMN IF NOT EXISTS original_debt_amount numeric DEFAULT NULL;
ALTER TABLE public.import_receipts ADD COLUMN IF NOT EXISTS original_debt_amount numeric DEFAULT NULL;

-- Backfill: for receipts with current debt > 0, original_debt = debt_amount (still unpaid)
-- For receipts with debt = 0, we can't know for sure, but we set original_debt = 0 (no debt from start or fully paid)
-- Going forward, new receipts will correctly set this field
UPDATE public.export_receipts SET original_debt_amount = debt_amount WHERE original_debt_amount IS NULL;
UPDATE public.import_receipts SET original_debt_amount = debt_amount WHERE original_debt_amount IS NULL;
