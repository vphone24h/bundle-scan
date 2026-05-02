ALTER TABLE public.salary_template_commissions
ADD COLUMN IF NOT EXISTS only_self_sold boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.salary_template_commissions.only_self_sold IS 'When true, this commission rule only applies to orders flagged as is_self_sold=true (employee''s own customer)';