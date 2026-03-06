ALTER TABLE public.tenant_landing_settings 
ADD COLUMN IF NOT EXISTS include_staff_in_email boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS include_rating_in_email boolean NOT NULL DEFAULT false;