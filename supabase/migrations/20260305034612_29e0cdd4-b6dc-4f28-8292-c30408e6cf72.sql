-- Clean up backup-only customers (no other transactions)
DELETE FROM customers
WHERE tenant_id = '66a834a2-6826-4cf6-8ce6-e5ceabce2780'
AND source IN ('backup', 'vphone1')
AND id NOT IN (
  SELECT DISTINCT customer_id FROM export_receipts 
  WHERE customer_id IS NOT NULL 
  AND tenant_id = '66a834a2-6826-4cf6-8ce6-e5ceabce2780'
);