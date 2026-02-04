-- Add show_tax field to invoice_templates table
-- This allows toggling VAT display on printed invoices
ALTER TABLE public.invoice_templates 
ADD COLUMN show_tax boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.invoice_templates.show_tax IS 'Toggle to show/hide VAT information on printed invoices';