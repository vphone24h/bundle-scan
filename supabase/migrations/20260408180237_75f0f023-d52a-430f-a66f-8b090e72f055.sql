
ALTER TABLE public.repair_orders 
ADD COLUMN IF NOT EXISTS handover_staff_id uuid,
ADD COLUMN IF NOT EXISTS handover_staff_name text;

COMMENT ON COLUMN public.repair_orders.handover_staff_id IS 'Staff who handed over the device to customer';
COMMENT ON COLUMN public.repair_orders.handover_staff_name IS 'Name of handover staff for display';
