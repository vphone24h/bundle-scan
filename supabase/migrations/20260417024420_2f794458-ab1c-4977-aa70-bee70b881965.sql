
-- Repair orders (warranty hot path)
CREATE INDEX IF NOT EXISTS idx_repair_orders_device_imei 
  ON public.repair_orders (device_imei) WHERE device_imei IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_repair_orders_code 
  ON public.repair_orders (code);
CREATE INDEX IF NOT EXISTS idx_repair_orders_customer_phone 
  ON public.repair_orders (customer_phone) WHERE customer_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_repair_orders_tenant_status_created 
  ON public.repair_orders (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repair_orders_customer_id 
  ON public.repair_orders (customer_id) WHERE customer_id IS NOT NULL;

-- Repair order items
CREATE INDEX IF NOT EXISTS idx_repair_order_items_repair_order_id 
  ON public.repair_order_items (repair_order_id);
CREATE INDEX IF NOT EXISTS idx_repair_order_items_product_imei 
  ON public.repair_order_items (product_imei) WHERE product_imei IS NOT NULL;

-- Products
CREATE INDEX IF NOT EXISTS idx_products_imei 
  ON public.products (imei) WHERE imei IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_tenant_sku 
  ON public.products (tenant_id, sku);

-- Export receipt items (warranty start date lookup)
CREATE INDEX IF NOT EXISTS idx_export_receipt_items_imei 
  ON public.export_receipt_items (imei) WHERE imei IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_export_receipt_items_receipt_id 
  ON public.export_receipt_items (receipt_id);
CREATE INDEX IF NOT EXISTS idx_export_receipt_items_product_id 
  ON public.export_receipt_items (product_id) WHERE product_id IS NOT NULL;

-- Export receipts
CREATE INDEX IF NOT EXISTS idx_export_receipts_tenant_created 
  ON public.export_receipts (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_receipts_code 
  ON public.export_receipts (code);
CREATE INDEX IF NOT EXISTS idx_export_receipts_customer_id 
  ON public.export_receipts (customer_id) WHERE customer_id IS NOT NULL;

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone 
  ON public.customers (tenant_id, phone) WHERE phone IS NOT NULL;

-- Cash book
CREATE INDEX IF NOT EXISTS idx_cash_book_tenant_date 
  ON public.cash_book (tenant_id, transaction_date DESC);

-- Attendance
CREATE INDEX IF NOT EXISTS idx_attendance_records_tenant_user_date 
  ON public.attendance_records (tenant_id, user_id, date DESC);

-- Repair status history
CREATE INDEX IF NOT EXISTS idx_repair_status_history_order 
  ON public.repair_status_history (repair_order_id, created_at);

-- Update planner stats
ANALYZE public.repair_orders;
ANALYZE public.repair_order_items;
ANALYZE public.products;
ANALYZE public.export_receipts;
ANALYZE public.export_receipt_items;
ANALYZE public.customers;
ANALYZE public.cash_book;
ANALYZE public.attendance_records;
