
-- Create sequence first
CREATE SEQUENCE IF NOT EXISTS public.unified_entity_code_seq START WITH 1;

-- Set sequence to a safe starting point
DO $$
DECLARE
  max_num integer := 0;
  tmp integer;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN entity_code ~ '-(\d+)$' THEN (regexp_replace(entity_code, '.*-', ''))::integer ELSE 0 END
  ), 0) INTO tmp FROM public.customers WHERE entity_code IS NOT NULL;
  IF tmp > max_num THEN max_num := tmp; END IF;

  SELECT COALESCE(MAX(
    CASE WHEN entity_code ~ '-(\d+)$' THEN (regexp_replace(entity_code, '.*-', ''))::integer ELSE 0 END
  ), 0) INTO tmp FROM public.suppliers WHERE entity_code IS NOT NULL;
  IF tmp > max_num THEN max_num := tmp; END IF;

  IF max_num > 0 THEN
    PERFORM setval('public.unified_entity_code_seq', max_num + 1, false);
  END IF;
END $$;

-- Backfill: Group suppliers by (tenant_id, name, branch_id) -> same DT code
DO $$
DECLARE
  grp RECORD;
  new_code text;
  cust_code text;
BEGIN
  FOR grp IN
    SELECT tenant_id, name, branch_id, array_agg(id ORDER BY created_at ASC) AS ids
    FROM public.suppliers
    WHERE tenant_id IS NOT NULL
    GROUP BY tenant_id, name, branch_id
  LOOP
    cust_code := NULL;
    SELECT c.entity_code INTO cust_code
    FROM public.suppliers s
    JOIN public.customers c ON c.phone = s.phone AND c.tenant_id = s.tenant_id
    WHERE s.id = ANY(grp.ids) AND s.phone IS NOT NULL AND s.phone != '' AND c.entity_code IS NOT NULL
    LIMIT 1;

    IF cust_code IS NOT NULL AND cust_code LIKE 'DT-%' THEN
      new_code := cust_code;
    ELSE
      new_code := 'DT-' || LPAD(nextval('public.unified_entity_code_seq')::text, 6, '0');
    END IF;

    UPDATE public.suppliers SET entity_code = new_code WHERE id = ANY(grp.ids);

    UPDATE public.customers c
    SET entity_code = new_code
    FROM public.suppliers s
    WHERE s.id = ANY(grp.ids)
      AND s.phone IS NOT NULL AND s.phone != ''
      AND c.phone = s.phone
      AND c.tenant_id = s.tenant_id;
  END LOOP;

  -- Assign DT codes to remaining customers with old KH- codes or NULL
  FOR grp IN
    SELECT id FROM public.customers WHERE entity_code IS NULL OR entity_code LIKE 'KH-%'
  LOOP
    new_code := 'DT-' || LPAD(nextval('public.unified_entity_code_seq')::text, 6, '0');
    UPDATE public.customers SET entity_code = new_code WHERE id = grp.id;
  END LOOP;
END $$;

-- Update supplier trigger: match by name+branch too
CREATE OR REPLACE FUNCTION public.auto_assign_supplier_entity_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  existing_code text;
BEGIN
  IF NEW.entity_code IS NOT NULL AND NEW.entity_code != '' AND NEW.entity_code LIKE 'DT-%' THEN
    RETURN NEW;
  END IF;

  -- Priority 1: customer with same phone
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    SELECT c.entity_code INTO existing_code
    FROM public.customers c
    WHERE c.phone = NEW.phone AND c.tenant_id = NEW.tenant_id AND c.entity_code LIKE 'DT-%'
    LIMIT 1;
  END IF;

  -- Priority 2: supplier with same name+branch
  IF existing_code IS NULL THEN
    SELECT s.entity_code INTO existing_code
    FROM public.suppliers s
    WHERE s.name = NEW.name AND s.branch_id IS NOT DISTINCT FROM NEW.branch_id AND s.tenant_id = NEW.tenant_id
      AND s.entity_code LIKE 'DT-%'
    LIMIT 1;
  END IF;

  NEW.entity_code := COALESCE(existing_code, 'DT-' || LPAD(nextval('public.unified_entity_code_seq')::text, 6, '0'));
  RETURN NEW;
END;
$fn$;

-- Update customer trigger
CREATE OR REPLACE FUNCTION public.auto_assign_customer_entity_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  existing_code text;
BEGIN
  IF NEW.entity_code IS NOT NULL AND NEW.entity_code != '' AND NEW.entity_code LIKE 'DT-%' THEN
    RETURN NEW;
  END IF;

  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    SELECT s.entity_code INTO existing_code
    FROM public.suppliers s
    WHERE s.phone = NEW.phone AND s.tenant_id = NEW.tenant_id AND s.entity_code LIKE 'DT-%'
    LIMIT 1;
  END IF;

  NEW.entity_code := COALESCE(existing_code, 'DT-' || LPAD(nextval('public.unified_entity_code_seq')::text, 6, '0'));
  RETURN NEW;
END;
$fn$;
