-- Add einvoice_enabled column to tenants table
ALTER TABLE public.tenants 
ADD COLUMN einvoice_enabled boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.tenants.einvoice_enabled IS 'Whether e-invoice feature is enabled for this tenant';