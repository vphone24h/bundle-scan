ALTER TABLE public.tenants DROP COLUMN IF EXISTS interest_enabled;

ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS interest_enabled boolean NOT NULL DEFAULT false;