
ALTER TABLE public.salary_templates
  ADD COLUMN IF NOT EXISTS bonus_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allowance_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kpi_bonus_amount numeric NOT NULL DEFAULT 0;
