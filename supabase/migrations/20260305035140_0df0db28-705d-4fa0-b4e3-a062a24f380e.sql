-- Fix BACKUP receipt prices: remove "+10 điểm" / "+5 điểm" contamination
-- Prices ending in "10" (from +10 điểm): divide by 100
-- Prices ending in "5" but not "10" (from +5 điểm): divide by 10

-- Fix export_receipts
UPDATE export_receipts
SET total_amount = FLOOR(total_amount / 100),
    paid_amount = FLOOR(paid_amount / 100)
WHERE code LIKE 'BACKUP-%'
  AND tenant_id = '66a834a2-6826-4cf6-8ce6-e5ceabce2780'
  AND total_amount > 0
  AND (total_amount % 100) = 10;

UPDATE export_receipts
SET total_amount = FLOOR(total_amount / 10),
    paid_amount = FLOOR(paid_amount / 10)
WHERE code LIKE 'BACKUP-%'
  AND tenant_id = '66a834a2-6826-4cf6-8ce6-e5ceabce2780'
  AND total_amount > 0
  AND (total_amount % 10) = 5
  AND (total_amount % 100) != 10;

-- Fix export_receipt_items
UPDATE export_receipt_items
SET sale_price = FLOOR(sale_price / 100)
WHERE receipt_id IN (
  SELECT id FROM export_receipts 
  WHERE code LIKE 'BACKUP-%' AND tenant_id = '66a834a2-6826-4cf6-8ce6-e5ceabce2780'
)
AND sale_price > 0
AND (sale_price % 100) = 10;

UPDATE export_receipt_items
SET sale_price = FLOOR(sale_price / 10)
WHERE receipt_id IN (
  SELECT id FROM export_receipts 
  WHERE code LIKE 'BACKUP-%' AND tenant_id = '66a834a2-6826-4cf6-8ce6-e5ceabce2780'
)
AND sale_price > 0
AND (sale_price % 10) = 5
AND (sale_price % 100) != 10;