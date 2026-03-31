
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS import_date_modified boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.import_date_modified IS 'Flag indicating import_date was manually edited';
