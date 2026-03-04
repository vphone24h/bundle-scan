
-- Delete items first, then receipts for backup orders
DELETE FROM export_receipt_items 
WHERE receipt_id IN (
  SELECT id FROM export_receipts 
  WHERE tenant_id = '66a834a2-6826-4cf6-8ce6-e5ceabce2780' 
  AND (note ILIKE '%[backup]%' OR note ILIKE '%[vphone1]%')
);

DELETE FROM export_receipts 
WHERE tenant_id = '66a834a2-6826-4cf6-8ce6-e5ceabce2780' 
AND (note ILIKE '%[backup]%' OR note ILIKE '%[vphone1]%');
