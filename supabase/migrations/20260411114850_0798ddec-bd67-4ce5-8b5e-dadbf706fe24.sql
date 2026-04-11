ALTER TABLE public.salary_template_penalties
ADD COLUMN threshold_minutes integer NOT NULL DEFAULT 0,
ADD COLUMN full_day_absence_minutes integer NOT NULL DEFAULT 0;