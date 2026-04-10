ALTER TABLE public.trusted_devices ADD COLUMN IF NOT EXISTS otp_code text;
ALTER TABLE public.trusted_devices ADD COLUMN IF NOT EXISTS otp_expires_at timestamptz;
ALTER TABLE public.trusted_devices ADD COLUMN IF NOT EXISTS approved_at timestamptz;