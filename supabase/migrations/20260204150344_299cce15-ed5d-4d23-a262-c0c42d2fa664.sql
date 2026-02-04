-- Add vat_rate column to export_receipts table
-- Default to 0 (0%) for records without VAT
ALTER TABLE public.export_receipts 
ADD COLUMN vat_rate numeric NOT NULL DEFAULT 0;

-- Add vat_amount column to store the calculated VAT amount
ALTER TABLE public.export_receipts 
ADD COLUMN vat_amount numeric NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.export_receipts.vat_rate IS 'VAT rate in percentage (e.g., 8 = 8%, 10 = 10%, 0 = no VAT)';
COMMENT ON COLUMN public.export_receipts.vat_amount IS 'Calculated VAT amount in VND';