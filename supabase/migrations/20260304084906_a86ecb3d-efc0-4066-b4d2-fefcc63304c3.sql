
-- Add email configuration columns to tenant_landing_settings
ALTER TABLE public.tenant_landing_settings 
ADD COLUMN IF NOT EXISTS order_email_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS order_email_sender text,
ADD COLUMN IF NOT EXISTS order_email_app_password text,
ADD COLUMN IF NOT EXISTS order_email_on_confirmed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS order_email_on_shipping boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS order_email_on_warranty boolean DEFAULT false;

-- Add customer_email to landing_orders if not exists
ALTER TABLE public.landing_orders 
ADD COLUMN IF NOT EXISTS customer_email text;

-- Add order_code to landing_orders for tracking
ALTER TABLE public.landing_orders 
ADD COLUMN IF NOT EXISTS order_code text;

-- Create email log table for tracking sent emails
CREATE TABLE IF NOT EXISTS public.landing_order_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  order_id uuid NOT NULL,
  email_type text NOT NULL DEFAULT 'order_confirmation',
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_order_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view email logs"
ON public.landing_order_email_logs
FOR SELECT
TO authenticated
USING (public.user_belongs_to_tenant(tenant_id));

-- Function to generate order code
CREATE OR REPLACE FUNCTION public.generate_landing_order_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count integer;
BEGIN
  SELECT COUNT(*) + 1 INTO _count
  FROM public.landing_orders
  WHERE tenant_id = NEW.tenant_id;
  
  NEW.order_code := '#' || LPAD(_count::text, 6, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_landing_order_code
BEFORE INSERT ON public.landing_orders
FOR EACH ROW
WHEN (NEW.order_code IS NULL)
EXECUTE FUNCTION public.generate_landing_order_code();
