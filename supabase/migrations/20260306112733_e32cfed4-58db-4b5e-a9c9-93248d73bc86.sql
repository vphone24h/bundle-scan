
-- Fix category_id for BACKUP items in Feb 2026 for vphone1
-- iPhone category
UPDATE export_receipt_items SET category_id = '37dfd674-8ae0-403e-b172-09086dde0fdc'
WHERE id IN (
  SELECT eri.id FROM export_receipt_items eri
  JOIN export_receipts er ON er.id = eri.receipt_id
  WHERE er.tenant_id = '66a834a2-6826-4cf6-8ce6-e5ceabce2780'
    AND er.code LIKE 'BACKUP-%'
    AND er.export_date >= '2026-02-01' AND er.export_date < '2026-03-01'
    AND eri.category_id IS NULL AND eri.status = 'sold'
    AND eri.product_name ILIKE 'iPhone%'
);

-- Pin category
UPDATE export_receipt_items SET category_id = '968c1d15-2941-4261-aa89-7b43167d85b0'
WHERE id IN (
  SELECT eri.id FROM export_receipt_items eri
  JOIN export_receipts er ON er.id = eri.receipt_id
  WHERE er.tenant_id = '66a834a2-6826-4cf6-8ce6-e5ceabce2780'
    AND er.code LIKE 'BACKUP-%'
    AND er.export_date >= '2026-02-01' AND er.export_date < '2026-03-01'
    AND eri.category_id IS NULL AND eri.status = 'sold'
    AND (eri.product_name ILIKE 'Pin %' OR eri.product_name ILIKE 'Bảng giá Thay PIN%' OR eri.product_name ILIKE 'Bảng giá thay Pin EU%')
);

-- Phụ Kiện for remaining
UPDATE export_receipt_items SET category_id = '185358d2-4517-4f8f-80f1-f3559a5516d8'
WHERE id IN (
  SELECT eri.id FROM export_receipt_items eri
  JOIN export_receipts er ON er.id = eri.receipt_id
  WHERE er.tenant_id = '66a834a2-6826-4cf6-8ce6-e5ceabce2780'
    AND er.code LIKE 'BACKUP-%'
    AND er.export_date >= '2026-02-01' AND er.export_date < '2026-03-01'
    AND eri.category_id IS NULL AND eri.status = 'sold'
);

-- Fix 1 item matchable by IMEI
UPDATE export_receipt_items SET product_id = '7bae0972-baf6-4b95-bbba-98f30d13e990', category_id = '37dfd674-8ae0-403e-b172-09086dde0fdc'
WHERE id = '044b405f-b71c-46e0-9eb5-aa3600687448';
