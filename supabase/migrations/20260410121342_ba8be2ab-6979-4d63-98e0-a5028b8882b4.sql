-- Critical performance indexes for report RPC
-- 1. export_receipt_payments: missing receipt_id index (JOIN bottleneck)
CREATE INDEX IF NOT EXISTS idx_erp_receipt_id ON public.export_receipt_payments USING btree (receipt_id);

-- 2. export_receipt_items: composite for profit/category queries  
CREATE INDEX IF NOT EXISTS idx_eri_receipt_status ON public.export_receipt_items USING btree (receipt_id, status);

-- 3. export_receipts: composite covering index for the main filter pattern
CREATE INDEX IF NOT EXISTS idx_er_tenant_status_date ON public.export_receipts USING btree (tenant_id, status, export_date);

-- 4. export_receipts: composite with branch for branch-filtered queries
CREATE INDEX IF NOT EXISTS idx_er_tenant_date_branch ON public.export_receipts USING btree (tenant_id, export_date, branch_id);

-- 5. export_returns: composite for tenant + fee_type + date range
CREATE INDEX IF NOT EXISTS idx_eret_tenant_fee_date_branch ON public.export_returns USING btree (tenant_id, fee_type, return_date, branch_id);

-- 6. export_receipt_items: product_id for LEFT JOIN to products
CREATE INDEX IF NOT EXISTS idx_eri_product_id ON public.export_receipt_items USING btree (product_id);

-- 7. export_receipt_items: category for GROUP BY queries
CREATE INDEX IF NOT EXISTS idx_eri_category_id ON public.export_receipt_items USING btree (category_id);