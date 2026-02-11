-- Add unique constraint to prevent duplicate reviews per export_receipt_item
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_reviews_unique_item 
ON staff_reviews (export_receipt_item_id) 
WHERE export_receipt_item_id IS NOT NULL;