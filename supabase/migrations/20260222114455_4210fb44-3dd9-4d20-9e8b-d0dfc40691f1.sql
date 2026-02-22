
-- Add call_status column: 'none' (chưa gọi), 'called' (đã gọi), 'unreachable' (không liên hệ được)
ALTER TABLE public.landing_orders 
ADD COLUMN call_status text NOT NULL DEFAULT 'none',
ADD COLUMN assigned_staff_id uuid NULL,
ADD COLUMN assigned_staff_name text NULL;
