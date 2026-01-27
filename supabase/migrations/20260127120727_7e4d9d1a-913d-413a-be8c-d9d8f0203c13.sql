-- Add is_data_hidden column to tenants table for hiding all data
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS is_data_hidden boolean DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.tenants.is_data_hidden IS 'When true, all data appears as empty/zero for the tenant';