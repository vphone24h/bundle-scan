-- Add self-sold flag to export receipts (sales staff personally brought the customer)
ALTER TABLE public.export_receipts
  ADD COLUMN IF NOT EXISTS is_self_sold boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_export_receipts_self_sold
  ON public.export_receipts (tenant_id, sales_staff_id)
  WHERE is_self_sold = true;

COMMENT ON COLUMN public.export_receipts.is_self_sold IS
  'True if the sales staff marked this receipt as a customer they personally brought in. Used by payroll commission rule target_type=self_sale.';