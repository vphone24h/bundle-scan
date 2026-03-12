
ALTER TABLE public.landing_product_blocked_dates
  ADD COLUMN IF NOT EXISTS check_in_time TEXT DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS check_out_time TEXT DEFAULT '12:00',
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;
