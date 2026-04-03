-- Composite indexes to speed up report and cash book queries
CREATE INDEX IF NOT EXISTS idx_cash_book_tenant_date_type ON public.cash_book (tenant_id, transaction_date, type);
CREATE INDEX IF NOT EXISTS idx_cash_book_tenant_biz_date ON public.cash_book (tenant_id, is_business_accounting, transaction_date) WHERE is_business_accounting = true;
CREATE INDEX IF NOT EXISTS idx_export_receipt_items_status_cat ON public.export_receipt_items (status, category_id);
CREATE INDEX IF NOT EXISTS idx_export_returns_tenant_fee_date ON public.export_returns (tenant_id, fee_type, return_date);