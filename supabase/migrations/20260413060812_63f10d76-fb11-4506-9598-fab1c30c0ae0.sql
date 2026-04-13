
ALTER TABLE public.salary_templates
ADD COLUMN enable_overtime boolean NOT NULL DEFAULT false;

-- Auto-enable for existing fixed monthly templates
UPDATE public.salary_templates
SET enable_overtime = true
WHERE salary_type = 'fixed_monthly';
