
ALTER TABLE public.export_receipts ADD COLUMN IF NOT EXISTS export_date_modified boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.export_receipts.export_date_modified IS 'Flag indicating export_date was manually edited';
