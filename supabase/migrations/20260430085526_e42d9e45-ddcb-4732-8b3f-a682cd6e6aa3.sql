
-- Add tiers JSONB to bonus and penalty tables for KPI tiered logic
ALTER TABLE public.salary_template_bonuses
  ADD COLUMN IF NOT EXISTS tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.salary_template_penalties
  ADD COLUMN IF NOT EXISTS tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Optional column for penalty target threshold (KPI target amount for kpi_not_met)
ALTER TABLE public.salary_template_penalties
  ADD COLUMN IF NOT EXISTS kpi_target numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.salary_template_bonuses.tiers IS 'Array of bonus tiers for KPI: [{percent_over: 10, bonus_amount: 500000, calc_type: "fixed_amount"|"percentage", value: number}]';
COMMENT ON COLUMN public.salary_template_penalties.tiers IS 'Array of penalty tiers for kpi_not_met: [{percent_achieved: 50, penalty_amount: 200000}]';
COMMENT ON COLUMN public.salary_template_penalties.kpi_target IS 'KPI target amount (VND) for kpi_not_met penalty';
