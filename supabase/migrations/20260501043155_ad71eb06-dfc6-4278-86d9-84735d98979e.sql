ALTER TABLE public.invoice_templates
  ADD COLUMN IF NOT EXISTS show_bank_qr BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bank_qr_label TEXT DEFAULT 'Quét mã để chuyển khoản',
  ADD COLUMN IF NOT EXISTS bank_bin TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_holder TEXT;