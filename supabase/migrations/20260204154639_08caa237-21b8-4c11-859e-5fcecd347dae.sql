-- Add 'warranty' to the product status options
-- Products with status 'warranty' are under supplier warranty and won't appear in inventory

-- Note: Since status is a text field, we just need to ensure the application
-- accepts and uses 'warranty' as a valid status value.
-- No schema change needed as status is already a text field.

-- Create a comment to document the valid status values
COMMENT ON COLUMN public.products.status IS 'Product status: in_stock, sold, returned, deleted, warranty';