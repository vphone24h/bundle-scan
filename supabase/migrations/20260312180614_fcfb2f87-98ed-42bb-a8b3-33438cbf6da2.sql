ALTER TABLE public.tenant_landing_settings 
  ADD COLUMN IF NOT EXISTS show_warranty_points boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_warranty_vouchers boolean DEFAULT true;