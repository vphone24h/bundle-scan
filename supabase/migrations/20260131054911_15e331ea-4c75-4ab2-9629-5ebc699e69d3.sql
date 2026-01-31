-- Add margin columns to invoice_templates table
ALTER TABLE public.invoice_templates 
ADD COLUMN IF NOT EXISTS margin_left integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS margin_right integer DEFAULT 0;