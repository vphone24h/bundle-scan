ALTER TABLE public.system_notifications 
ADD COLUMN IF NOT EXISTS send_frequency text NOT NULL DEFAULT 'once';