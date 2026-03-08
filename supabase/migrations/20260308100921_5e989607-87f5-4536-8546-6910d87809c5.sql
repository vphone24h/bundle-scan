
-- Backfill: Unify entity_code for customers and suppliers with same (name, branch, tenant)
DO $$
DECLARE
  grp RECORD;
  unified_code text;
BEGIN
  FOR grp IN
    SELECT 
      c.tenant_id,
      c.name,
      c.preferred_branch_id AS c_branch_id,
      s.branch_id AS s_branch_id,
      c.entity_code AS c_code,
      s.entity_code AS s_code,
      array_agg(DISTINCT c.id) AS customer_ids,
      array_agg(DISTINCT s.id) AS supplier_ids
    FROM public.customers c
    JOIN public.suppliers s 
      ON s.tenant_id = c.tenant_id
      AND LOWER(TRIM(s.name)) = LOWER(TRIM(c.name))
      AND s.branch_id IS NOT DISTINCT FROM c.preferred_branch_id
    WHERE c.entity_code IS NOT NULL 
      AND s.entity_code IS NOT NULL
      AND c.entity_code != s.entity_code
      AND (
        (c.phone IS NULL OR c.phone = '' OR s.phone IS NULL OR s.phone = '')
        OR c.phone = s.phone
      )
    GROUP BY c.tenant_id, c.name, c.preferred_branch_id, s.branch_id, c.entity_code, s.entity_code
  LOOP
    IF grp.c_code < grp.s_code THEN
      unified_code := grp.c_code;
    ELSE
      unified_code := grp.s_code;
    END IF;

    UPDATE public.customers SET entity_code = unified_code WHERE id = ANY(grp.customer_ids);
    UPDATE public.suppliers SET entity_code = unified_code WHERE id = ANY(grp.supplier_ids);
  END LOOP;
END $$;

-- Update supplier trigger: also cross-match by name+branch with customers
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

  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    SELECT c.entity_code INTO existing_code
    FROM public.customers c
    WHERE c.phone = NEW.phone AND c.tenant_id = NEW.tenant_id AND c.entity_code LIKE 'DT-%'
    LIMIT 1;
  END IF;

  IF existing_code IS NULL THEN
    SELECT c.entity_code INTO existing_code
    FROM public.customers c
    WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(NEW.name))
      AND c.preferred_branch_id IS NOT DISTINCT FROM NEW.branch_id
      AND c.tenant_id = NEW.tenant_id
      AND c.entity_code LIKE 'DT-%'
    LIMIT 1;
  END IF;

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

-- Update customer trigger: also cross-match by name+branch with suppliers
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

  IF existing_code IS NULL THEN
    SELECT s.entity_code INTO existing_code
    FROM public.suppliers s
    WHERE LOWER(TRIM(s.name)) = LOWER(TRIM(NEW.name))
      AND s.branch_id IS NOT DISTINCT FROM NEW.preferred_branch_id
      AND s.tenant_id = NEW.tenant_id
      AND s.entity_code LIKE 'DT-%'
    LIMIT 1;
  END IF;

  IF existing_code IS NULL THEN
    SELECT c.entity_code INTO existing_code
    FROM public.customers c
    WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(NEW.name))
      AND c.preferred_branch_id IS NOT DISTINCT FROM NEW.preferred_branch_id
      AND c.tenant_id = NEW.tenant_id
      AND c.entity_code LIKE 'DT-%'
    LIMIT 1;
  END IF;

  NEW.entity_code := COALESCE(existing_code, 'DT-' || LPAD(nextval('public.unified_entity_code_seq')::text, 6, '0'));
  RETURN NEW;
END;
$fn$;
