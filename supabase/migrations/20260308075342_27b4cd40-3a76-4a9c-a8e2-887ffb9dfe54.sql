
-- Add payment config columns to tenant_landing_settings
ALTER TABLE public.tenant_landing_settings
  ADD COLUMN IF NOT EXISTS payment_cod_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_transfer_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_bank_name text,
  ADD COLUMN IF NOT EXISTS payment_account_number text,
  ADD COLUMN IF NOT EXISTS payment_account_holder text,
  ADD COLUMN IF NOT EXISTS payment_confirm_zalo_url text,
  ADD COLUMN IF NOT EXISTS payment_confirm_messenger_url text;

-- Add payment method columns to landing_orders
ALTER TABLE public.landing_orders
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'cod',
  ADD COLUMN IF NOT EXISTS transfer_content text;
