
-- Enable pg_net for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to trigger auto debt offset via edge function
CREATE OR REPLACE FUNCTION public.trigger_auto_debt_offset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  _tenant_id uuid;
  _entity_code text;
  _supabase_url text;
  _anon_key text;
BEGIN
  -- Get tenant_id from the record
  _tenant_id := NEW.tenant_id;
  IF _tenant_id IS NULL THEN RETURN NEW; END IF;

  -- Only trigger when there's actual debt (debt_amount > 0)
  IF TG_TABLE_NAME = 'export_receipts' THEN
    IF COALESCE(NEW.debt_amount, 0) <= 0 THEN RETURN NEW; END IF;
    -- Get entity_code from customer
    SELECT entity_code INTO _entity_code FROM public.customers WHERE id = NEW.customer_id LIMIT 1;
  ELSIF TG_TABLE_NAME = 'import_receipts' THEN
    IF COALESCE(NEW.debt_amount, 0) <= 0 THEN RETURN NEW; END IF;
    -- Get entity_code from supplier
    SELECT entity_code INTO _entity_code FROM public.suppliers WHERE id = NEW.supplier_id LIMIT 1;
  ELSIF TG_TABLE_NAME = 'debt_payments' THEN
    IF NEW.payment_type != 'addition' THEN RETURN NEW; END IF;
    IF NEW.payment_source = 'debt_offset' THEN RETURN NEW; END IF;
    -- Get entity_code from customer or supplier
    IF NEW.entity_type = 'customer' THEN
      SELECT entity_code INTO _entity_code FROM public.customers WHERE id = NEW.entity_id::uuid LIMIT 1;
    ELSE
      SELECT entity_code INTO _entity_code FROM public.suppliers WHERE id = NEW.entity_id::uuid LIMIT 1;
    END IF;
  END IF;

  -- Only proceed if entity has a code (potential match)
  IF _entity_code IS NULL THEN RETURN NEW; END IF;

  -- Call edge function via pg_net
  PERFORM extensions.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/auto-debt-offset',
    body := jsonb_build_object('tenant_id', _tenant_id, 'entity_code', _entity_code),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the main operation
  RAISE WARNING 'Auto debt offset trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$fn$;

-- Trigger on export_receipts (customer debt)
DROP TRIGGER IF EXISTS trg_auto_debt_offset_export ON public.export_receipts;
CREATE TRIGGER trg_auto_debt_offset_export
  AFTER INSERT OR UPDATE OF debt_amount ON public.export_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_debt_offset();

-- Trigger on import_receipts (supplier debt)
DROP TRIGGER IF EXISTS trg_auto_debt_offset_import ON public.import_receipts;
CREATE TRIGGER trg_auto_debt_offset_import
  AFTER INSERT OR UPDATE OF debt_amount ON public.import_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_debt_offset();

-- Trigger on debt_payments (manual debt addition)
DROP TRIGGER IF EXISTS trg_auto_debt_offset_debt ON public.debt_payments;
CREATE TRIGGER trg_auto_debt_offset_debt
  AFTER INSERT ON public.debt_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_debt_offset();
