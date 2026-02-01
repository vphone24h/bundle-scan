-- Thêm cột show_warranty và custom_description cho mẫu in hóa đơn
ALTER TABLE public.invoice_templates 
ADD COLUMN IF NOT EXISTS show_warranty BOOLEAN DEFAULT true;

ALTER TABLE public.invoice_templates 
ADD COLUMN IF NOT EXISTS show_custom_description BOOLEAN DEFAULT false;

ALTER TABLE public.invoice_templates 
ADD COLUMN IF NOT EXISTS custom_description_text TEXT;