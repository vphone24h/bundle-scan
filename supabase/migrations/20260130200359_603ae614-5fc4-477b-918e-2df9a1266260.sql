-- Add additional_addresses column to store multiple addresses
ALTER TABLE public.tenant_landing_settings
ADD COLUMN IF NOT EXISTS additional_addresses text[] DEFAULT '{}'::text[];