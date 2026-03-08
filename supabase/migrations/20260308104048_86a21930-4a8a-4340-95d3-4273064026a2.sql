
-- Fix: Re-sync entity_code when phone/name is updated on existing records

-- Supplier trigger: allow re-assignment when phone changes
CREATE OR REPLACE FUNCTION public.auto_assign_supplier_entity_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  existing_code text;
BEGIN
  -- On INSERT: skip if already has a DT- code
  -- On UPDATE: re-evaluate if phone or name changed
  IF TG_OP = 'INSERT' THEN
    IF NEW.entity_code IS NOT NULL AND NEW.entity_code != '' AND NEW.entity_code LIKE 'DT-%' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only re-evaluate if phone or name changed
    IF OLD.phone IS NOT DISTINCT FROM NEW.phone AND OLD.name IS NOT DISTINCT FROM NEW.name THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Priority 1: Match by phone in customers
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    SELECT c.entity_code INTO existing_code
    FROM public.customers c
    WHERE c.phone = NEW.phone AND c.tenant_id = NEW.tenant_id AND c.entity_code LIKE 'DT-%'
    LIMIT 1;
  END IF;

  -- Priority 2: Match by name+branch in customers
  IF existing_code IS NULL THEN
    SELECT c.entity_code INTO existing_code
    FROM public.customers c
    WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(NEW.name))
      AND c.preferred_branch_id IS NOT DISTINCT FROM NEW.branch_id
      AND c.tenant_id = NEW.tenant_id
      AND c.entity_code LIKE 'DT-%'
    LIMIT 1;
  END IF;

  -- Priority 3: Match by name+branch in suppliers (same table)
  IF existing_code IS NULL THEN
    SELECT s.entity_code INTO existing_code
    FROM public.suppliers s
    WHERE s.id != NEW.id
      AND s.name = NEW.name AND s.branch_id IS NOT DISTINCT FROM NEW.branch_id AND s.tenant_id = NEW.tenant_id
      AND s.entity_code LIKE 'DT-%'
    LIMIT 1;
  END IF;

  NEW.entity_code := COALESCE(existing_code, 'DT-' || LPAD(nextval('public.unified_entity_code_seq')::text, 6, '0'));
  
  -- On UPDATE: also sync the matched customer's entity_code if we found a cross-match
  IF TG_OP = 'UPDATE' AND existing_code IS NOT NULL AND existing_code != OLD.entity_code THEN
    -- Update other suppliers with old code to new code
    UPDATE public.suppliers SET entity_code = existing_code
    WHERE entity_code = OLD.entity_code AND tenant_id = NEW.tenant_id AND id != NEW.id;
  END IF;

  RETURN NEW;
END;
$fn$;

-- Customer trigger: allow re-assignment when phone changes  
CREATE OR REPLACE FUNCTION public.auto_assign_customer_entity_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  existing_code text;
BEGIN
  -- On INSERT: skip if already has a DT- code
  -- On UPDATE: re-evaluate if phone or name changed
  IF TG_OP = 'INSERT' THEN
    IF NEW.entity_code IS NOT NULL AND NEW.entity_code != '' AND NEW.entity_code LIKE 'DT-%' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.phone IS NOT DISTINCT FROM NEW.phone AND OLD.name IS NOT DISTINCT FROM NEW.name THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Priority 1: Match by phone in suppliers
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    SELECT s.entity_code INTO existing_code
    FROM public.suppliers s
    WHERE s.phone = NEW.phone AND s.tenant_id = NEW.tenant_id AND s.entity_code LIKE 'DT-%'
    LIMIT 1;
  END IF;

  -- Priority 2: Match by name+branch in suppliers
  IF existing_code IS NULL THEN
    SELECT s.entity_code INTO existing_code
    FROM public.suppliers s
    WHERE LOWER(TRIM(s.name)) = LOWER(TRIM(NEW.name))
      AND s.branch_id IS NOT DISTINCT FROM NEW.preferred_branch_id
      AND s.tenant_id = NEW.tenant_id
      AND s.entity_code LIKE 'DT-%'
    LIMIT 1;
  END IF;

  -- Priority 3: Match by name+branch in customers (same table)
  IF existing_code IS NULL THEN
    SELECT c.entity_code INTO existing_code
    FROM public.customers c
    WHERE c.id != NEW.id
      AND LOWER(TRIM(c.name)) = LOWER(TRIM(NEW.name))
      AND c.preferred_branch_id IS NOT DISTINCT FROM NEW.preferred_branch_id
      AND c.tenant_id = NEW.tenant_id
      AND c.entity_code LIKE 'DT-%'
    LIMIT 1;
  END IF;

  NEW.entity_code := COALESCE(existing_code, 'DT-' || LPAD(nextval('public.unified_entity_code_seq')::text, 6, '0'));

  -- On UPDATE: also sync the matched supplier's entity_code if we found a cross-match
  IF TG_OP = 'UPDATE' AND existing_code IS NOT NULL AND existing_code != OLD.entity_code THEN
    UPDATE public.customers SET entity_code = existing_code
    WHERE entity_code = OLD.entity_code AND tenant_id = NEW.tenant_id AND id != NEW.id;
  END IF;

  RETURN NEW;
END;
$fn$;

-- Make triggers fire on UPDATE too (drop and recreate)
DROP TRIGGER IF EXISTS trg_auto_supplier_entity_code ON public.suppliers;
CREATE TRIGGER trg_auto_supplier_entity_code
  BEFORE INSERT OR UPDATE OF phone, name ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_supplier_entity_code();

DROP TRIGGER IF EXISTS trg_auto_customer_entity_code ON public.customers;
CREATE TRIGGER trg_auto_customer_entity_code
  BEFORE INSERT OR UPDATE OF phone, name ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_customer_entity_code();

-- Backfill: sync entity_code for matching phone numbers across tables
DO $$
DECLARE
  pair RECORD;
  unified text;
BEGIN
  FOR pair IN
    SELECT 
      c.tenant_id,
      c.phone,
      MIN(c.entity_code) AS c_code,
      MIN(s.entity_code) AS s_code
    FROM public.customers c
    JOIN public.suppliers s 
      ON s.tenant_id = c.tenant_id
      AND s.phone = c.phone
    WHERE c.phone IS NOT NULL AND c.phone != ''
      AND c.entity_code IS NOT NULL AND s.entity_code IS NOT NULL
      AND c.entity_code != s.entity_code
    GROUP BY c.tenant_id, c.phone
  LOOP
    IF pair.c_code < pair.s_code THEN
      unified := pair.c_code;
    ELSE
      unified := pair.s_code;
    END IF;

    UPDATE public.customers SET entity_code = unified
    WHERE phone = pair.phone AND tenant_id = pair.tenant_id AND entity_code != unified;
    
    UPDATE public.suppliers SET entity_code = unified
    WHERE phone = pair.phone AND tenant_id = pair.tenant_id AND entity_code != unified;
  END LOOP;
END $$;
