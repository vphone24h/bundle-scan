-- Fix import flow: allow custom payment sources by changing enum payment_type to text
ALTER TABLE public.receipt_payments
ALTER COLUMN payment_type TYPE text
USING payment_type::text;