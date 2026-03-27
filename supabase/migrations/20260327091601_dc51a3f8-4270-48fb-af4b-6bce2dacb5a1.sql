
ALTER TABLE public.import_returns ADD COLUMN IF NOT EXISTS quantity numeric NOT NULL DEFAULT 1;
ALTER TABLE public.export_returns ADD COLUMN IF NOT EXISTS quantity numeric NOT NULL DEFAULT 1;
