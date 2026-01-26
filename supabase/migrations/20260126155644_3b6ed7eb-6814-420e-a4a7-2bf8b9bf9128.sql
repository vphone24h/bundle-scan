-- Add max redeem amount column to point_settings
ALTER TABLE public.point_settings
ADD COLUMN max_redeem_amount numeric DEFAULT NULL,
ADD COLUMN use_max_amount_limit boolean DEFAULT false,
ADD COLUMN use_percentage_limit boolean DEFAULT true;