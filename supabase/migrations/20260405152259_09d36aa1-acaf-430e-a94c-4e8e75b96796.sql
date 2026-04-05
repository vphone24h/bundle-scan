
-- Combined GIN index for OR searches across name, sku, imei
CREATE INDEX IF NOT EXISTS idx_products_name_sku_imei_gin
ON public.products
USING gin ((coalesce(name, '') || ' ' || coalesce(sku, '') || ' ' || coalesce(imei, '')) gin_trgm_ops);
