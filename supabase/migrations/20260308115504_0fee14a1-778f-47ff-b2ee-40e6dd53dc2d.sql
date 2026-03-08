ALTER TABLE public.landing_orders 
ADD COLUMN IF NOT EXISTS action_type text DEFAULT 'order',
ADD COLUMN IF NOT EXISTS action_date text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS action_time text DEFAULT NULL;