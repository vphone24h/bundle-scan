-- Add warranty column to export_receipt_items table
ALTER TABLE public.export_receipt_items
ADD COLUMN warranty TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.export_receipt_items.warranty IS 'Warranty information for the sold product';