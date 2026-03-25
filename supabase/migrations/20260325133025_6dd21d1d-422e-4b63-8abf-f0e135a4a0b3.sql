
-- Add unit and quantity columns to export_receipt_items
ALTER TABLE public.export_receipt_items 
  ADD COLUMN IF NOT EXISTS unit text DEFAULT 'cái',
  ADD COLUMN IF NOT EXISTS quantity numeric(15,3) DEFAULT 1;
