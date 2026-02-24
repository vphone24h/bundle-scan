
-- Thắt chặt: Xóa policy anon INSERT trực tiếp vì claim voucher qua RPC SECURITY DEFINER
DROP POLICY IF EXISTS "Anon can insert vouchers via website" ON public.customer_vouchers;

-- Thắt chặt: Anon chỉ SELECT voucher theo tenant_id cụ thể (qua RPC lookup_customer_vouchers_public)
DROP POLICY IF EXISTS "Anon can view own vouchers by phone" ON public.customer_vouchers;
