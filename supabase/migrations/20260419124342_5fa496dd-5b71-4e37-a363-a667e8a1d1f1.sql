ALTER TABLE public.invoice_templates
  ADD COLUMN IF NOT EXISTS show_warranty_qr BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warranty_qr_label TEXT DEFAULT 'Quét mã để tra cứu bảo hành';