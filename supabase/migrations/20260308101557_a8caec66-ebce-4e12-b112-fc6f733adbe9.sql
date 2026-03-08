
-- Fix trigger to use correct pg_net API with project URL
CREATE OR REPLACE FUNCTION public.trigger_auto_debt_offset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  _tenant_id uuid;
  _entity_code text;
BEGIN
  _tenant_id := NEW.tenant_id;
  IF _tenant_id IS NULL THEN RETURN NEW; END IF;

  -- Only trigger when there's actual debt
  IF TG_TABLE_NAME = 'export_receipts' THEN
    IF COALESCE(NEW.debt_amount, 0) <= 0 THEN RETURN NEW; END IF;
    SELECT entity_code INTO _entity_code FROM public.customers WHERE id = NEW.customer_id LIMIT 1;
  ELSIF TG_TABLE_NAME = 'import_receipts' THEN
    IF COALESCE(NEW.debt_amount, 0) <= 0 THEN RETURN NEW; END IF;
    SELECT entity_code INTO _entity_code FROM public.suppliers WHERE id = NEW.supplier_id LIMIT 1;
  ELSIF TG_TABLE_NAME = 'debt_payments' THEN
    IF NEW.payment_type != 'addition' THEN RETURN NEW; END IF;
    IF NEW.payment_source = 'debt_offset' THEN RETURN NEW; END IF;
    IF NEW.entity_type = 'customer' THEN
      SELECT entity_code INTO _entity_code FROM public.customers WHERE id = NEW.entity_id::uuid LIMIT 1;
    ELSE
      SELECT entity_code INTO _entity_code FROM public.suppliers WHERE id = NEW.entity_id::uuid LIMIT 1;
    END IF;
  END IF;

  IF _entity_code IS NULL THEN RETURN NEW; END IF;

  -- Call edge function via pg_net
  PERFORM net.http_post(
    url := 'https://rodpbhesrwykmpywiiyd.supabase.co/functions/v1/auto-debt-offset',
    body := jsonb_build_object('tenant_id', _tenant_id, 'entity_code', _entity_code),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvZHBiaGVzcnd5a21weXdpaXlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MjM4MDMsImV4cCI6MjA4NDk5OTgwM30.P7Kc0pxkUdyHi8AgDBlRmPqxg0MWr2C_J_EUqORQY_s'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Auto debt offset trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$fn$;
